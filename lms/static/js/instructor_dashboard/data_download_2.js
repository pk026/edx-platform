/* globals _, DataDonwload, PendingInstructorTasks, ReportDownloads */

(function() {
    'use strict';
  // eslint-disable-next-line no-unused-vars
    var DataDownloadV2, PendingInstructorTasks, ReportDownloads, statusAjaxError;

    statusAjaxError = function() {
        return window.InstructorDashboard.util.statusAjaxError.apply(this, arguments);
    };

    PendingInstructorTasks = function() {
        return window.InstructorDashboard.util.PendingInstructorTasks;
    };

    ReportDownloads = function() {
        return window.InstructorDashboard.util.ReportDownloads;
    };

    DataDownloadV2 = (function() {
        function InstructorDashboardDataDownload($section) {
            var dataDownloadObj = this;
            this.$section = $section;
            this.$section.data('wrapper', this);
            this.$list_problem_responses_csv_input = this.$section.find("input[name='problem-location']");
            this.$download_display_text = $('.data-display-text');
            this.$download_request_response_error = $('.request-response-error');
            this.$download_display_table = $('.profile-data-display-table');
            this.$reports_request_response = $('.request-response');
            this.$reports_request_response_error = $('.request-response-error');
            this.report_downloads = new (ReportDownloads())(this.$section);
            this.instructor_tasks = new (PendingInstructorTasks())(this.$section);
            this.$download_report = $('.download-report');
            this.$gradeReportDownload = $('.grade-report-download');
            this.$report_type_selector = $('.report-type');
            this.$selection_informations = $('.selectionInfo');
            this.$certificate_display_table = $('.certificate-data-display-table');
            this.$downloadProblemReport = $('#download-problem-report');
            this.$navButton = $('.data-download-nav .btn-link');
            this.$selectedSection = $('#' + this.$navButton.first().attr('data-section'));
            this.$learnerStatus = $('.learner-status');

            this.clear_display = function() {
                this.$download_display_text.empty();
                this.$download_display_table.empty();
                this.$download_request_response_error.empty();
                this.$reports_request_response.empty();
                this.$reports_request_response_error.empty();
                this.$certificate_display_table.empty();
                $('.msg-confirm').css({
                    display: 'none'
                });
                return $('.msg-error').css({
                    display: 'none'
                });
            };

            this.clear_display();

            this.$navButton.click(function(event) {
                var selectedSection = '#' + $(this).attr('data-section');
                event.preventDefault();
                $('.data-download-nav .btn-link').removeClass('active-section');
                $('section.tab-data').hide();
                $(selectedSection).show();
                $(this).addClass('active-section');

                $(this).find('select').trigger('change');
                dataDownloadObj.$selectedSection = $(selectedSection);

                dataDownloadObj.clear_display();
            });

            this.$navButton.first().click();

            this.$report_type_selector.change(function() {
                var selectedOption = dataDownloadObj.$report_type_selector.val();
                dataDownloadObj.$selection_informations.each(function(index, ele) {
                    if ($(ele).hasClass(selectedOption)) {
                        $(ele).show();
                    } else {
                        $(ele).hide();
                    }
                });
                dataDownloadObj.clear_display();
            });

            this.clickHandler = function() {
                var selectedOption = dataDownloadObj.$selectedSection.find('select').find('option:selected');
                dataDownloadObj[selectedOption.val()](selectedOption);
            };
            this.$download_report.click(dataDownloadObj.clickHandler);

            this.viewCertificates = function(selected) {
                var url = selected.data('endpoint');
                dataDownloadObj.clear_display();
                dataDownloadObj.$certificate_display_table.text(gettext('Loading data...'));
                return $.ajax({
                    type: 'POST',
                    url: url,
                    error: function() {
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$download_request_response_error.text(
                            gettext('Error getting issued certificates list.')
                        );
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.buildDataTable(data);
                    }
                });
            };

            this.downloadCertificates = function(selected) {
                location.href = selected.data('endpoint') + '?csv=true';
            };

            this.listAnonymizeStudentIDs = function(select) {
                location.href = select.data('endpoint');
            };

            this.proctoredExamResults = function(selected) {
                var url = selected.data('endpoint');
                var errorMessage = gettext('Error generating proctored exam results. Please try again.');
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function(error) {
                        if (error.responseText) {
                            errorMessage = JSON.parse(error.responseText);
                        }
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$reports_request_response_error.text(errorMessage);
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            };

            this.surveyResultReport = function(selected) {
                var url = selected.data('endpoint');
                var errorMessage = gettext('Error generating survey results. Please try again.');
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function(error) {
                        if (error.responseText) {
                            errorMessage = JSON.parse(error.responseText);
                        }
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$reports_request_response_error.text(errorMessage);
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            };

            this.profileInformation = function(selected) {
                var url = selected.data('endpoint') + '/csv';
                var errorMessage = gettext('Error generating student profile information. Please try again.');
                dataDownloadObj.clear_display();
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function(error) {
                        if (error.responseText) {
                            errorMessage = JSON.parse(error.responseText);
                        }
                        dataDownloadObj.$reports_request_response_error.text(errorMessage);
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            };

            this.listEnrolledPeople = function(selected) {
                var url = selected.data('endpoint');
                dataDownloadObj.clear_display();
                dataDownloadObj.$download_display_table.text(gettext('Loading'));
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function() {
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$download_request_response_error.text(
                            gettext('Error getting student list.')
                        );
                        return dataDownloadObj.$download_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.buildDataTable(data);
                    }
                });
            };

            this.$downloadProblemReport.click(function(event) {
                var url = $(event.target).data('endpoint');
                dataDownloadObj.clear_display();
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    data: {
                        problem_location: dataDownloadObj.$list_problem_responses_csv_input.val()
                    },
                    error: function(error) {
                        dataDownloadObj.$reports_request_response_error.text(
                            JSON.parse(error.responseText)
                        );
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            });

            this.learnerWhoCanEnroll = function(selected) {
                var url = selected.data('endpoint');
                var errorMessage = gettext('Error generating list of students who may enroll. Please try again.');
                dataDownloadObj.clear_display();
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function(error) {
                        if (error.responseText) {
                            errorMessage = JSON.parse(error.responseText);
                        }
                        dataDownloadObj.$reports_request_response_error.text(errorMessage);
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            };

            this.gradingConfiguration = function(selected) {
                var url = selected.data('endpoint');
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    error: function() {
                        dataDownloadObj.clear_display();
                        dataDownloadObj.$download_request_response_error.text(
                            gettext('Error retrieving grading configuration.')
                        );
                        return dataDownloadObj.$download_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.clear_display();
                        return edx.HtmlUtils.setHtml(
                            dataDownloadObj.$download_display_text, edx.HtmlUtils.HTML(data.grading_config_summary));
                    }
                });
            };

            this.$gradeReportDownload.click(function() {
                var errorMessage = gettext('Error generating grades. Please try again.');
                var learnerStatus = dataDownloadObj.$learnerStatus.val();
                dataDownloadObj.downloadCSV($(this), errorMessage, learnerStatus);
            });

            this.problemGradeReport = function(selected) {
                var errorMessage = gettext('Error generating problem grade report. Please try again.');
                dataDownloadObj.downloadCSV(selected, errorMessage, false);
            };

            this.ORADataReport = function(selected) {
                var errorMessage = gettext('Error generating ORA data report. Please try again.');
                dataDownloadObj.downloadCSV(selected, errorMessage, false);
            };

            this.downloadCSV = function(selected, errorMessage, learnerStatus) {
                var url = selected.data('endpoint');
                dataDownloadObj.clear_display();
                return $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    url: url,
                    data: {verified_learners_only: learnerStatus},
                    error: function(error) {
                        if (error.responseText) {
                          // eslint-disable-next-line no-param-reassign
                            errorMessage = JSON.parse(error.responseText);
                        }
                        dataDownloadObj.$reports_request_response_error.text(errorMessage);
                        return dataDownloadObj.$reports_request_response_error.css({
                            display: 'block'
                        });
                    },
                    success: function(data) {
                        dataDownloadObj.$reports_request_response.text(data.status);
                        return $('.msg-confirm').css({
                            display: 'block'
                        });
                    }
                });
            };

            this.buildDataTable = function(data) {
                var $tablePlaceholder, columns, feature, gridData, options;
                dataDownloadObj.clear_display();
                options = {
                    enableCellNavigation: true,
                    enableColumnReorder: false,
                    forceFitColumns: true,
                    rowHeight: 35
                };
                columns = (function() {
                    var i, len, ref, results;
                    ref = data.queried_features;
                    results = [];
                    for (i = 0, len = ref.length; i < len; i++) {
                        feature = ref[i];
                        results.push({
                            id: feature,
                            field: feature,
                            name: data.feature_names[feature]
                        });
                    }
                    return results;
                }());
                gridData = data.hasOwnProperty('students') ? data.students : data.certificates;
                $tablePlaceholder = $('<div/>', {
                    class: 'slickgrid'
                });
                dataDownloadObj.$download_display_table.append($tablePlaceholder);
                return new window.Slick.Grid($tablePlaceholder, gridData, columns, options);
            };
        }

        InstructorDashboardDataDownload.prototype.onClickTitle = function() {
            this.clear_display();
            this.instructor_tasks.task_poller.start();
            return this.report_downloads.downloads_poller.start();
        };

        InstructorDashboardDataDownload.prototype.onExit = function() {
            this.instructor_tasks.task_poller.stop();
            return this.report_downloads.downloads_poller.stop();
        };
        return InstructorDashboardDataDownload;
    }());

    _.defaults(window, {
        InstructorDashboard: {}
    });

    _.defaults(window.InstructorDashboard, {
        sections: {}
    });

    _.defaults(window.InstructorDashboard.sections, {
        DataDownloadV2: DataDownloadV2
    });
}).call(this);
