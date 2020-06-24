"""
Utilities for waffle.

Includes namespacing, caching, and course overrides for waffle flags.

Usage:

For Waffle Flags, first set up the namespace, and then create flags using the
namespace.  For example::

   WAFFLE_FLAG_NAMESPACE = WaffleFlagNamespace(name='my_namespace')

   # Use CourseWaffleFlag when you are in the context of a course.
   SOME_COURSE_FLAG = CourseWaffleFlag(WAFFLE_FLAG_NAMESPACE, 'some_course_feature')
   # Use WaffleFlag when outside the context of a course.
   SOME_FLAG = WaffleFlag(WAFFLE_FLAG_NAMESPACE, 'some_feature')

You can check these flags in code using the following::

    SOME_FLAG.is_enabled()
    SOME_COURSE_FLAG.is_enabled(course_key)

To test these WaffleFlags, see testutils.py.

In the above examples, you will use Django Admin "waffle" section to configure
for a flag named: my_namespace.some_course_feature

You could also use the Django Admin "waffle_utils" section to configure a course
override for this same flag (e.g. my_namespace.some_course_feature).

For Waffle Switches, first set up the namespace, and then create the flag name.
For example::

    WAFFLE_SWITCHES = WaffleSwitchNamespace(name=WAFFLE_NAMESPACE)

    ESTIMATE_FIRST_ATTEMPTED = 'estimate_first_attempted'

You can then use the switch as follows::

    WAFFLE_SWITCHES.is_enabled(waffle.ESTIMATE_FIRST_ATTEMPTED)

To test WaffleSwitchNamespace, use the provided context managers.  For example:

    with WAFFLE_SWITCHES.override(waffle.ESTIMATE_FIRST_ATTEMPTED, active=True):
        ...

For long-lived flags, you may want to change the default for devstack, sandboxes,
or new Open edX releases. For help with this, see:
openedx/core/djangoapps/waffle_utils/docs/decisions/0001-refactor-waffle-flag-default.rst

Also see ``WAFFLE_FLAG_CUSTOM_METRICS`` and docstring for _set_waffle_flag_metric
for temporarily instrumenting/monitoring waffle flag usage.

"""

import logging
import warnings
from abc import ABCMeta
from contextlib import contextmanager

import crum
import six
from django.conf import settings
from edx_django_utils.monitoring import set_custom_metric
from opaque_keys.edx.keys import CourseKey
from waffle import flag_is_active, switch_is_active

from openedx.core.lib.cache_utils import get_cache as get_request_cache

log = logging.getLogger(__name__)


class WaffleNamespace(six.with_metaclass(ABCMeta, object)):
    """
    A base class for a request cached namespace for waffle flags/switches.

    An instance of this class represents a single namespace
    (e.g. "course_experience"), and can be used to work with a set of
    flags or switches that will all share this namespace.
    """

    def __init__(self, name, log_prefix=None):
        """
        Initializes the waffle namespace instance.

        Arguments:
            name (String): Namespace string appended to start of all waffle
                flags and switches (e.g. "grades")
            log_prefix (String): Optional string to be appended to log messages
                (e.g. "Grades: "). Defaults to ''.

        """
        assert name, "The name is required."
        self.name = name
        self.log_prefix = log_prefix if log_prefix else ''

    def _namespaced_name(self, setting_name):
        """
        Returns the namespaced name of the waffle switch/flag.

        For example, the namespaced name of a waffle switch/flag would be:
            my_namespace.my_setting_name

        Arguments:
            setting_name (String): The name of the flag or switch.
        """
        return u'{}.{}'.format(self.name, setting_name)

    @staticmethod
    def _get_request_cache():
        """
        Returns a request cache shared by all instances of this class.
        """
        return get_request_cache('WaffleNamespace')


class WaffleSwitchNamespace(WaffleNamespace):
    """
    Provides a single namespace for a set of waffle switches.

    All namespaced switch values are stored in a single request cache containing
    all switches for all namespaces.
    """
    def is_enabled(self, switch_name):
        """
        Returns and caches whether the given waffle switch is enabled.
        """
        namespaced_switch_name = self._namespaced_name(switch_name)
        value = self._cached_switches.get(namespaced_switch_name)
        if value is None:
            value = switch_is_active(namespaced_switch_name)
            self._cached_switches[namespaced_switch_name] = value
        return value

    @contextmanager
    def override(self, switch_name, active=True):
        """
        Overrides the active value for the given switch for the duration of this
        contextmanager.
        Note: The value is overridden in the request cache AND in the model.
        """
        previous_active = self.is_enabled(switch_name)
        try:
            self.override_for_request(switch_name, active)
            with self.override_in_model(switch_name, active):
                yield
        finally:
            self.override_for_request(switch_name, previous_active)

    def override_for_request(self, switch_name, active=True):
        """
        Overrides the active value for the given switch for the remainder of
        this request (as this is not a context manager).
        Note: The value is overridden in the request cache, not in the model.
        """
        namespaced_switch_name = self._namespaced_name(switch_name)
        self._cached_switches[namespaced_switch_name] = active
        log.info(u"%sSwitch '%s' set to %s for request.", self.log_prefix, namespaced_switch_name, active)

    @contextmanager
    def override_in_model(self, switch_name, active=True):
        """
        Overrides the active value for the given switch for the duration of this
        contextmanager.
        Note: The value is overridden in the model, not the request cache.
        """
        # Import is placed here to avoid model import at project startup.
        from waffle.testutils import override_switch as waffle_override_switch
        namespaced_switch_name = self._namespaced_name(switch_name)
        with waffle_override_switch(namespaced_switch_name, active):
            log.info(u"%sSwitch '%s' set to %s in model.", self.log_prefix, namespaced_switch_name, active)
            yield

    @property
    def _cached_switches(self):
        """
        Returns a dictionary of all namespaced switches in the request cache.
        """
        return self._get_request_cache().setdefault('switches', {})


class WaffleSwitch(object):
    """
    Represents a single waffle switch, using a cached namespace.
    """
    def __init__(self, waffle_namespace, switch_name):
        """
        Arguments:
            waffle_namespace (WaffleSwitchNamespace | String): Namespace for this switch.
            switch_name (String): The name of the switch (without namespacing).
        """
        if isinstance(waffle_namespace, six.string_types):
            waffle_namespace = WaffleSwitchNamespace(name=waffle_namespace)

        self.waffle_namespace = waffle_namespace
        self.switch_name = switch_name

    @property
    def namespaced_switch_name(self):
        """
        Returns the fully namespaced switch name.
        """
        return self.waffle_namespace._namespaced_name(self.switch_name)  # pylint: disable=protected-access

    def is_enabled(self):
        return self.waffle_namespace.is_enabled(self.switch_name)

    @contextmanager
    def override(self, active=True):
        with self.waffle_namespace.override(self.switch_name, active):
            yield


class WaffleFlagNamespace(six.with_metaclass(ABCMeta, WaffleNamespace)):
    """
    Provides a single namespace for a set of waffle flags.

    All namespaced flag values are stored in a single request cache containing
    all flags for all namespaces.
    """

    @property
    def _cached_flags(self):
        """
        Returns a dictionary of all namespaced flags in the request cache.
        """
        return self._get_request_cache().setdefault('flags', {})

    def is_flag_active(self, flag_name, check_before_waffle_callback=None, flag_undefined_default=None):
        """
        Returns and caches whether the provided flag is active.

        If the flag value is already cached in the request, it is returned.
        If check_before_waffle_callback is supplied, it is called before
            checking waffle.
        If check_before_waffle_callback returns None, or if it is not supplied,
            then waffle is used to check the flag.

        Important: Caching for the check_before_waffle_callback must be handled
            by the callback itself.

        Arguments:
            flag_name (String): The name of the flag to check.
            check_before_waffle_callback (function): (Optional) A function that
                will be checked before continuing on to waffle. If
                check_before_waffle_callback(namespaced_flag_name) returns True
                or False, it is returned. If it returns None, then waffle is
                used.
            DEPRECATED flag_undefined_default (Boolean): A default value to be
                returned if the waffle flag is to be checked, but doesn't exist.
                See module docstring for alternative.
        """
        # Import is placed here to avoid model import at project startup.
        from waffle.models import Flag

        if flag_undefined_default:
            warnings.warn(
                # NOTE: This will be removed once ARCHBOM-132, currently in-progress, is complete.
                'flag_undefined_default has been deprecated. For existing uses this is already actively being fixed.',
                DeprecationWarning
            )

        # validate arguments
        namespaced_flag_name = self._namespaced_name(flag_name)
        value = None
        if check_before_waffle_callback:
            value = check_before_waffle_callback(namespaced_flag_name)

        if value is None:
            # Do not get cached value for the callback, because the key might be different.
            # The callback needs to handle its own caching if it wants it.
            value = self._cached_flags.get(namespaced_flag_name)
            if value is None:

                if flag_undefined_default is not None:
                    # determine if the flag is undefined in waffle
                    try:
                        Flag.objects.get(name=namespaced_flag_name)
                    except Flag.DoesNotExist:
                        if flag_undefined_default:
                            # This metric will go away once this has been fully retired with ARCHBOM-132.
                            # Also, even though the value will only track the last flag, that should be enough.
                            set_custom_metric('temp_flag_default_used', namespaced_flag_name)
                        value = flag_undefined_default

                if value is None:
                    request = crum.get_current_request()
                    if request:
                        value = flag_is_active(request, namespaced_flag_name)
                    else:
                        log.warning(u"%sFlag '%s' accessed without a request", self.log_prefix, namespaced_flag_name)
                        set_custom_metric('warn_flag_no_request', True)
                        # Return the default value if not in a request context.
                        # Note: this skips the cache as the value might be different
                        # in a normal request context. This case seems to occur when
                        # a page redirects to a 404. In this case, we'll just return
                        # the default value.
                        value = bool(flag_undefined_default)
                        self._set_waffle_flag_metric(namespaced_flag_name, value)
                        return value

                self._cached_flags[namespaced_flag_name] = value

        self._set_waffle_flag_metric(namespaced_flag_name, value)
        return value

    def _set_waffle_flag_metric(self, name, value):
        """
        For any flag name in _WAFFLE_FLAG_CUSTOM_METRIC_SET, add name/value
        to cached values and set custom metric if the value changed.

        The name of the custom metric will have the prefix ``flag_`` and the
        suffix will match the name of the flag.
        The value of the custom metric could be False, True, or Both.

          The value Both would mean that the flag had both a True and False
          value at different times during the transaction. This is most
          likely due to having a check_before_waffle_callback, as is the
          case with CourseWaffleFlag.

        An example NewRelic query to see the values of a flag in different
        environments, if your waffle flag was named ``my.waffle.flag`` might
        look like::

          SELECT count(*) FROM Transaction
          WHERE flag_my.waffle.flag IS NOT NULL
          FACET appName, flag_my.waffle.flag

        Important: Remember to configure ``WAFFLE_FLAG_CUSTOM_METRICS`` for
          LMS, Studio and Workers in order to see waffle flag usage in all
          edx-platform environments.

        """
        if name not in _WAFFLE_FLAG_CUSTOM_METRIC_SET:
            return

        flag_metric_data = self._get_request_cache().setdefault('flag_metric', {})
        is_value_change = False
        if name not in flag_metric_data:
            flag_metric_data[name] = str(value)
            is_value_change = True
        else:
            if flag_metric_data[name] != str(value):
                flag_metric_data[name] = 'Both'
                is_value_change = True

        if is_value_change:
            metric_name = 'flag_{}'.format(name)
            set_custom_metric(metric_name, flag_metric_data[name])


def _get_waffle_flag_custom_metrics_set():
    """
    Returns a set based on the Django setting WAFFLE_FLAG_CUSTOM_METRICS (list).
    """
    waffle_flag_custom_metrics = getattr(settings, _WAFFLE_FLAG_CUSTOM_METRICS, None)
    waffle_flag_custom_metrics = waffle_flag_custom_metrics if waffle_flag_custom_metrics else []
    return set(waffle_flag_custom_metrics)

    # .. toggle_name: WAFFLE_FLAG_CUSTOM_METRICS
    # .. toggle_implementation: DjangoSetting
    # .. toggle_default: False
    # .. toggle_description: A list of waffle flag to track with custom metrics having values of (True, False, or Both).
    # .. toggle_category: monitoring
    # .. toggle_use_cases: opt_in
    # .. toggle_creation_date: 2020-06-17
    # .. toggle_expiration_date: None
    # .. toggle_tickets: None
    # .. toggle_status: supported
    # .. toggle_warnings: Intent is for temporary research (1 day - several weeks) of a flag's usage.
_WAFFLE_FLAG_CUSTOM_METRICS = 'WAFFLE_FLAG_CUSTOM_METRICS'

# set of waffle flags that should be instrumented with custom metrics
_WAFFLE_FLAG_CUSTOM_METRIC_SET = _get_waffle_flag_custom_metrics_set()


class WaffleFlag(object):
    """
    Represents a single waffle flag, using a cached waffle namespace.
    """

    def __init__(self, waffle_namespace, flag_name, flag_undefined_default=None):
        """
        Initializes the waffle flag instance.

        Arguments:
            waffle_namespace (WaffleFlagNamespace | String): Namespace for this flag.
            flag_name (String): The name of the flag (without namespacing).
            DEPRECATED flag_undefined_default (Boolean): A default value to be returned
                if the waffle flag is to be checked, but doesn't exist. See module
                docstring for alternative.
        """
        if isinstance(waffle_namespace, six.string_types):
            waffle_namespace = WaffleFlagNamespace(name=waffle_namespace)

        self.waffle_namespace = waffle_namespace
        self.waffle_namespace = waffle_namespace
        self.flag_name = flag_name
        self.flag_undefined_default = flag_undefined_default

    @property
    def namespaced_flag_name(self):
        """
        Returns the fully namespaced flag name.
        """
        return self.waffle_namespace._namespaced_name(self.flag_name)

    def is_enabled(self):
        """
        Returns whether or not the flag is enabled.
        """
        return self.waffle_namespace.is_flag_active(
            self.flag_name,
            flag_undefined_default=self.flag_undefined_default
        )

    @contextmanager
    def override(self, active=True):
        # TODO We can move this import to the top of the file once this code is
        # not all contained within the __init__ module.
        from openedx.core.djangoapps.waffle_utils.testutils import override_waffle_flag
        with override_waffle_flag(self, active):
            yield


class CourseWaffleFlag(WaffleFlag):
    """
    Represents a single waffle flag that can be forced on/off for a course.

    Uses a cached waffle namespace.
    """

    def _get_course_override_callback(self, course_key):
        """
        Returns a function to use as the check_before_waffle_callback.

        Arguments:
            course_key (CourseKey): The course to check for override before
            checking waffle.
        """
        def course_override_callback(namespaced_flag_name):
            """
            Returns True/False if the flag was forced on or off for the provided
            course.  Returns None if the flag was not overridden.

            Note: Has side effect of caching the override value.

            Arguments:
                namespaced_flag_name (String): A namespaced version of the flag
                    to check.
            """
            # Import is placed here to avoid model import at project startup.
            from .models import WaffleFlagCourseOverrideModel
            cache_key = u'{}.{}'.format(namespaced_flag_name, six.text_type(course_key))
            force_override = self.waffle_namespace._cached_flags.get(cache_key)

            if force_override is None:
                force_override = WaffleFlagCourseOverrideModel.override_value(namespaced_flag_name, course_key)
                self.waffle_namespace._cached_flags[cache_key] = force_override

            if force_override == WaffleFlagCourseOverrideModel.ALL_CHOICES.on:
                return True
            if force_override == WaffleFlagCourseOverrideModel.ALL_CHOICES.off:
                return False
            return None

        return course_override_callback

    def _is_enabled(self, course_key=None):
        """
        Returns whether or not the flag is enabled without error checking.

        Arguments:
            course_key (CourseKey): The course to check for override before
            checking waffle.
        """
        return self.waffle_namespace.is_flag_active(
            self.flag_name,
            check_before_waffle_callback=self._get_course_override_callback(course_key),
            flag_undefined_default=self.flag_undefined_default
        )

    def is_enabled_without_course_context(self):
        """
        Returns whether or not the flag is enabled outside the context of a given course.
        This should only be used when a course waffle flag must be used outside of a course.
        If this is intended for use with a simple global setting, use simple waffle flag instead.
        """
        return self._is_enabled()

    def is_enabled(self, course_key=None):
        """
        Returns whether or not the flag is enabled within the context of a given course.

        Arguments:
            course_key (CourseKey): The course to check for override before
            checking waffle.
        """
        # validate arguments
        assert issubclass(type(course_key), CourseKey), u"The course_key '{}' must be a CourseKey.".format(
            str(course_key)
        )

        return self._is_enabled(course_key)
