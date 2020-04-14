/* global define, DataDownload */

define([
    'jquery',
    'js/instructor_dashboard/data_download_2',
    'edx-ui-toolkit/js/utils/spec-helpers/ajax-helpers'
],
  function($, id, AjaxHelper) {
      'use strict';
      describe('edx.instructor_dashboard.data_download', function() {
          var requests, $selected, dataDownload, url;

          beforeEach(function() {
              loadFixtures('js/fixtures/instructor_dashboard/data_download.html');

              dataDownload = window.InstructorDashboard.sections;
              dataDownload.DataDownloadV2($('#data_download_2'));
              window.InstructorDashboard.util.PendingInstructorTasks = function() {
                  return;
              };
              requests = AjaxHelper.requests(this);
              $selected = $('<option data-endpoint="api/url/fake"></option>');
              url = $selected.data('endpoint');
          });

          it('renders grading config returned by the server in case of successful request ', function() {
              dataDownload.gradingConfiguration($selected);

              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, {
                  course_id: 'course-v1:university+cs101+2019',
                  grading_config_summary: 'This is message from the server',
                  success: true
              });
              expect(dataDownload.$download_display_text.text()).toContain('This is message from the server');
          });


          it('renders profile information success message ', function() {
              var data = {
                  status: 'The profile information report is being created.'
              };
              dataDownload.profileInformation($selected);
              AjaxHelper.expectRequest(requests, 'POST', url + '/csv');
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });

          it('renders learner Report students report in case of successful request ', function() {
              var data = {
                  status: 'The Learner report report is being created'
              };
              dataDownload.learnerWhoCanEnroll($selected);
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });

          it('renders enrolled student list in case of successful request ', function() {
              var data = {
                  available_features: [
                      'id',
                      'username',
                      'first_name',
                      'last_name',
                      'is_staff',
                      'email',
                      'date_joined',
                      'last_login',
                      'name',
                      'language',
                      'location',
                      'year_of_birth',
                      'gender',
                      'level_of_education',
                      'mailing_address',
                      'goals',
                      'meta',
                      'city',
                      'country'
                  ],
                  course_id: 'test_course_101',
                  feature_names: {
                      gender: 'Gender',
                      goals: 'Goals',
                      enrollment_mode: 'Enrollment Mode',
                      email: 'Email',
                      country: 'Country',
                      id: 'User ID',
                      mailing_address: 'Mailing Address',
                      last_login: 'Last Login',
                      date_joined: 'Date Joined',
                      location: 'Location',
                      city: 'City',
                      verification_status: 'Verification Status',
                      year_of_birth: 'Birth Year',
                      name: 'Name',
                      username: 'Username',
                      level_of_education: 'Level of Education',
                      language: 'Language'
                  },
                  students: [
                      {
                          gender: 'Male',
                          goals: 'Goal',
                          enrollment_mode: 'audit',
                          email: 'test@example.com',
                          country: 'PK',
                          year_of_birth: 'None',
                          id: '8',
                          mailing_address: 'None',
                          last_login: '2020-06-17T08:17:00.561Z',
                          date_joined: '2019-09-25T20:06:17.564Z',
                          location: 'None',
                          verification_status: 'N/A',
                          city: 'None',
                          name: 'None',
                          username: 'test',
                          level_of_education: 'None',
                          language: 'None'
                      }
                  ],
                  queried_features: [
                      'id',
                      'username',
                      'name',
                      'email',
                      'language',
                      'location',
                      'year_of_birth',
                      'gender',
                      'level_of_education',
                      'mailing_address',
                      'goals',
                      'enrollment_mode',
                      'verification_status',
                      'last_login',
                      'date_joined',
                      'city',
                      'country'
                  ],
                  students_count: 1
              };
              dataDownload.listEnrolledPeople($selected);
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
            // eslint-disable-next-line vars-on-top
              var dataTable = dataDownload.$certificate_display_table.html();
            // eslint-disable-next-line vars-on-top
              var existInHtml = function(value) {
                  expect(dataTable.indexOf(data.feature_names[value]) !== -1).toBe(false);
                  expect(dataTable.indexOf(data.students[0][value]) !== -1).toBe(false);
              };
              data.queried_features.forEach(existInHtml);
          });


          it('renders ORA grading success message ', function() {
              var data = {
                  status: 'The ORA data report is being created'
              };
              dataDownload.ORADataReport($selected);
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });

          it('Download Problem Report message in case of successful request ', function() {
              var data = {
                  status: 'The Problem report is being created'
              };
              spyOn($.fn, 'data').and.returnValue(url);
              dataDownload.$downloadProblemReport.trigger('click');
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });

          it('renders certificate table in case of successful request ', function() {
              var data = {
                  certificates: [{course_id: 'xyz_test', mode: 'honor'}],
                  queried_features: ['course_id', 'mode'],
                  feature_names: {course_id: 'Course ID', mode: ' Mode'}
              };
              dataDownload.viewCertificates($selected);
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
            // eslint-disable-next-line vars-on-top
              var dataTable = dataDownload.$certificate_display_table.html();
              expect(dataTable.indexOf('Course ID') !== -1).toBe(false);
              expect(dataTable.indexOf('Mode') !== -1).toBe(false);
              expect(dataTable.indexOf('honor') !== -1).toBe(false);
              expect(dataTable.indexOf('xyz_test') !== -1).toBe(false);
          });

          it('renders Course grade report in case of successful request ', function() {
              var data = {
                  status: 'The Course grade report is being created'
              };
              spyOn($.fn, 'data').and.returnValue(url);
              dataDownload.$gradeReportDownload.trigger('click');
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });

          it('renders Problem grade report in case of successful request ', function() {
              var data = {
                  status: 'The Problem grade report is being created'
              };
              dataDownload.problemGradeReport($selected);
              AjaxHelper.expectRequest(requests, 'POST', url);
              AjaxHelper.respondWithJson(requests, data);
              expect(dataDownload.$reports_request_response.text()).toBe(data.status);
          });


          it('Navigates to tabs properly', function() {
              var $navbtn = $(dataDownload.$navButton[1]);
              var selectedSection = '#' + $navbtn.attr('data-section');
              $navbtn.trigger('click');
              expect($(selectedSection).is(':visible')).toBe(true);
              expect($navbtn.hasClass('active-section')).toBe(true);
          });
      });
  });
