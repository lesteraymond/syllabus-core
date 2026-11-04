import { createRequire } from "node:module";
import * as e$30 from "react";
import { Children, Fragment, act, createContext, forwardRef, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Window } from "happy-dom";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region src/i18n/store.js
const listeners = /* @__PURE__ */ new Set();
let language = "en";
const normalizeLanguage = (value) => value === "tl" ? "tl" : "en";
const getLanguage = () => language;
const getLocale = () => language === "tl" ? "fil-PH" : "en-US";
function setLanguage(value) {
	const next = normalizeLanguage(value);
	if (next === language) return;
	language = next;
	if (typeof document !== "undefined") document.documentElement.lang = next;
	listeners.forEach((listener) => listener());
}
//#endregion
//#region src/i18n/messages.js
const en$1 = {
	"dashboard.welcomeBack": "Welcome back, {name}!",
	"ui.syllabus_saved_as_p0_60fc5d": "Syllabus saved as {p0}.",
	"ui.syllabus_submitted_for_review_f317be": "Syllabus submitted for review.",
	"ui.submit_failed_adb15a": "Submit failed: ",
	"ui.syllabus_p0_bf213e": "Syllabus {p0}.",
	"ui.update_failed_f7b7c9": "Update failed: ",
	"ui.only_draft_syllabi_can_be_deleted_by_faculty_832244": "Only draft syllabi can be deleted by faculty.",
	"ui.syllabus_deleted_638a8c": "Syllabus deleted.",
	"ui.delete_failed_c834e9": "Delete failed: ",
	"ui.your_activity_list_was_cleared_642fa2": "Your activity list was cleared.",
	"ui.logging_out_3df779": "Logging out…",
	"ui.loading_b04ba4": "Loading...",
	"ui.the_two_passwords_do_not_match_d9ae81": "The two passwords do not match.",
	"ui.the_password_could_not_be_changed_ceb60b": "The password could not be changed.",
	"ui.college_logo_1df91f": "College logo",
	"ui.first_sign_in_e8fad6": "First sign-in",
	"ui.choose_your_own_password_19d96e": "Choose your own password",
	"ui.you_are_signed_in_as_531cce": "You are signed in as ",
	"ui.with_a_temporary_password_choose_a_new_one_to_continue_c9567a": " with a temporary password. Choose a new one to continue.",
	"ui.new_password_159d33": "New password ",
	"ui.hide_passwords_37701c": "Hide passwords",
	"ui.show_passwords_a76567": "Show passwords",
	"ui.type_it_again_da6510": "Type it again ",
	"ui.saving_56a228": "Saving…",
	"ui.save_and_continue_3b033f": "Save and continue",
	"ui.sign_out_dc1649": "Sign out",
	"ui.messages_f1702b": "Messages",
	"ui.unknown_bc7819": "Unknown",
	"ui.delete_conversation_de4346": "Delete conversation",
	"ui.delete_all_messages_this_cannot_be_undone_39516a": "Delete all messages? This cannot be undone.",
	"ui.cancel_77dfd2": "Cancel",
	"ui.delete_f6fdbe": "Delete",
	"ui.no_messages_yet_start_a_conversation_d5ea96": "No messages yet. Start a conversation.",
	"ui.read_927abf": "✓ Read",
	"ui.sent_610540": "✓ Sent",
	"ui.type_a_message_09bdff": "Type a message...",
	"ui.send_9bc257": "Send",
	"ui.check_history_087c5b": "Check history",
	"ui.each_checked_subject_appears_once_newest_first_open_one_to_see_it_468518": "Each checked subject appears once, newest first. Open one to see its scoring.",
	"ui.filter_the_history_by_date_771c36": "Filter the history by date",
	"ui.from_3f6605": "From",
	"ui.to_ae79ea": "To",
	"ui.apply_cfea41": "Apply",
	"ui.reset_44c57a": "Reset",
	"ui.the_from_date_is_after_the_to_date_2c84ad": "The From date is after the To date.",
	"ui.loading_the_history_8f2942": "Loading the history…",
	"ui.no_check_was_stored_in_this_date_range_548438": "No check was stored in this date range. ",
	"ui.no_syllabus_has_been_checked_yet_ec0425": "No syllabus has been checked yet.",
	"ui.checked_d42130": ", checked ",
	"ui.unknown_faculty_753147": "Unknown faculty",
	"ui.by_administrator_c55e2e": "By administrator",
	"ui.on_submit_952d52": "On submit",
	"ui.checked_b2bc0c": "Checked",
	"ui.show_more_ada6d7": "Show more (",
	"ui.more_5ca940": " more)",
	"ui.checked_aca936": "Checked ",
	"ui.this_is_an_earlier_check_newer_results_are_in_the_history_32d14b": "This is an earlier check. Newer results are in the history.",
	"ui.this_syllabus_is_approved_so_this_check_is_final_6d57e9": "This syllabus is approved, so this check is final.",
	"ui.compliance_score_7a084d": "Compliance score ",
	"ui.percent_c72154": " percent, ",
	"ui.no_score_yet_3662ab": "No score yet",
	"ui.not_enough_content_1c0e67": "Not enough content",
	"ui.not_checked_22705e": "Not checked",
	"ui.close_bbfa77": "Close",
	"ui.enter_the_email_address_you_registered_with_8e2dd3": "Enter the email address you registered with.",
	"ui.the_request_could_not_be_sent_11fa24": "The request could not be sent.",
	"ui.forgot_password_5ed117": "Forgot password",
	"ui.get_a_temporary_password_c137bb": "Get a temporary password",
	"ui.if_ed46f9": "If ",
	"ui.is_registered_a_temporary_password_has_been_sent_to_it_it_works_f_64f2a8": " is registered, a temporary password has been sent to it. It works for 30 minutes, and you will be asked to choose a new password when you use it.",
	"ui.your_current_password_still_works_until_you_do_e6c36b": "Your current password still works until you do.",
	"ui.back_to_sign_in_4da821": "Back to sign in",
	"ui.type_the_email_address_you_were_registered_with_we_will_email_you_b27a78": "Type the email address you were registered with. We will email you a temporary password.",
	"ui.type_your_registered_email_address_4e92a6": "Type your email address you were registered with.",
	"ui.email_2f707b": "Email ",
	"ui.name_university_edu_ph_4d6969": "name@university.edu.ph",
	"ui.sending_cf7655": "Sending…",
	"ui.send_temporary_password_02ad7e": "Send temporary password",
	"ui.enter_your_username_email_and_password_7bf61f": "Enter your username/email and password.",
	"ui.academic_quality_93a706": "ACADEMIC QUALITY",
	"ui.syllabus_1b731d": "Syllabus",
	"ui.management_system_738978": "Management System",
	"ui.build_validate_review_approve_archive_and_analyze_undergraduate_s_0aef77": "Build, validate, review, approve, archive, and analyze undergraduate syllabi in one institutional workspace.",
	"ui.ai_compliance_602783": " AI Compliance",
	"ui.approval_workflow_cc8935": " Approval Workflow",
	"ui.welcome_back_593f1e": "WELCOME BACK",
	"ui.sign_in_to_sms_52fec0": "Sign in to SMS",
	"ui.sign_in_to_login_7c41d8": "Sign in to Login",
	"ui.use_your_institutional_account_to_continue_143ca3": "Use your institutional account to continue.",
	"ui.username_or_email_728ae0": "Username or Email",
	"ui.password_8be3c9": "Password",
	"ui.hide_password_e40123": "Hide password",
	"ui.show_password_044b85": "Show password",
	"ui.remember_me_3444b2": " Remember me",
	"ui.forgot_password_4c29f7": "Forgot password?",
	"ui.sign_in_f8492c": "Sign In",
	"ui.or_175835": "or",
	"ui.register_for_students_2f6e9d": "Register (for Students)",
	"ui.main_navigation_efd197": "Main navigation",
	"ui.expand_sidebar_f462e8": "Expand sidebar",
	"ui.collapse_sidebar_9e6876": "Collapse sidebar",
	"ui.cict_logo_dee290": "CICT logo",
	"ui.sms_9e10d4": "SMS",
	"ui.cite_brand_5b2e91": "CITE",
	"ui.is_this_your_cor_1d57c8": "Is this your COR?",
	"ui.this_is_what_we_read_from_your_photo_it_can_t_be_edited_here_c24d4b": "This is what we read from your photo. It can't be edited here.",
	"ui.not_readable_c35717": "Not readable",
	"ui.enrolled_subjects_0ea329": "Enrolled subjects",
	"ui.we_could_not_read_the_subject_list_from_your_photo_this_will_not__c5b836": "We could not read the subject list from your photo. This will not stop you from registering.",
	"ui.your_enrollment_in_bsit_looks_confirmed_your_account_will_be_read_fa67fa": "Your enrollment in BSIT looks confirmed. Your account will be ready right away.",
	"ui.we_could_not_confirm_everything_on_your_cor_you_can_still_registe_0afe9d": "We could not confirm everything on your COR. You can still register: an administrator will check your COR before you can sign in. A clearer photo (full page, flat, good light) may avoid the wait.",
	"ui.retake_photo_4873d4": "Retake photo",
	"ui.creating_account_27b8a2": "Creating account...",
	"ui.confirm_and_register_558ffe": "Confirm and register",
	"ui.upload_a_photo_of_your_cor_jpg_png_or_webp_b5323e": "Upload a photo of your COR (JPG, PNG or WebP).",
	"ui.that_photo_is_larger_than_10mb_801f53": "That photo is larger than 10MB.",
	"ui.use_a_password_of_at_least_8_characters_69cc28": "Use a password of at least 8 characters.",
	"ui.the_passwords_do_not_match_540a66": "The passwords do not match.",
	"ui.upload_your_cor_to_continue_da868b": "Upload your COR to continue.",
	"ui.registration_complete_ab7971": "Registration Complete",
	"ui.waiting_for_verification_a113ec": "Waiting for Verification",
	"ui.back_to_sign_in_c65048": "Back to Sign In",
	"ui.student_registration_ef00b6": "STUDENT REGISTRATION",
	"ui.create_your_account_4046b5": "Create your account",
	"ui.for_bsit_students_we_read_your_cor_to_verify_your_enrollment_and__bed562": "For BSIT students. We read your COR to verify your enrollment, and your student ID becomes your username.",
	"ui.certificate_of_registration_cor_0ef71c": "Certificate of Registration (COR) ",
	"ui.click_or_drop_to_replace_7c5654": "Click or drop to replace",
	"ui.take_a_photo_or_upload_your_cor_cea856": "Take a photo or upload your COR",
	"ui.whole_page_flat_in_good_light_image_only_max_10mb_73f731": "Whole page, flat, in good light • Image only • Max 10MB",
	"ui.password_0aa0ce": "Password ",
	"ui.at_least_8_characters_1fe494": "At least 8 characters",
	"ui.confirm_password_228465": "Confirm password ",
	"ui.type_it_again_488399": "Type it again",
	"ui.reading_your_cor_this_can_take_a_few_seconds_595ad5": "Reading your COR... this can take a few seconds",
	"ui.scan_cor_and_continue_696299": "Scan COR and continue",
	"ui.back_to_sign_in_e52282": "← Back to Sign In",
	"ui.reviewer_comments_7d59b1": "Reviewer comments",
	"ui.notes_from_your_reviewer_about_this_syllabus_including_the_reason_d994eb": "Notes from your reviewer about this syllabus, including the reason for a decision. To talk it over, send a message.",
	"ui.reply_by_message_0df524": "✉ Reply by message",
	"ui.choose_a_syllabus_to_check_b6f6d2": "Choose a syllabus to check",
	"ui.choose_a_syllabus_cd5a79": "Choose a syllabus",
	"ui.syllabi_waiting_for_their_first_check_once_checked_a_syllabus_mov_d3e75a": "Syllabi waiting for their first check. Once checked, a syllabus moves to the history below.",
	"ui.faculty_9ae050": "Faculty",
	"ui.loading_33ce41": "Loading…",
	"ui.nothing_is_waiting_for_a_check_28b41a": "Nothing is waiting for a check",
	"ui.choose_a_faculty_member_65ac86": "Choose a faculty member",
	"ui.program_9d6800": "Program",
	"ui.choose_a_program_2d5477": "Choose a program",
	"ui.no_program_d8600a": "No program",
	"ui.subject_8d183d": "Subject",
	"ui.choose_a_subject_554b9c": "Choose a subject",
	"ui.checking_820d60": "Checking…",
	"ui.not_checked_yet_82bd72": "Not checked yet",
	"ui.this_syllabus_was_uploaded_as_a_file_so_only_the_file_and_its_cou_b947f8": "This syllabus was uploaded as a file, so only the file and its course details are checked. Matching it to the template needs the AI service, which is not switched on yet.",
	"ui.there_is_nothing_in_this_syllabus_that_can_be_checked_32e258": "There is nothing in this syllabus that can be checked.",
	"ui.loading_syllabi_264639": "Loading syllabi…",
	"ui.every_submitted_syllabus_has_been_checked_see_the_history_below_4c13bf": "Every submitted syllabus has been checked. See the history below.",
	"ui.nothing_chosen_yet_a7c4c2": "Nothing chosen yet.",
	"ui.check_compliance_342b8f": "Check compliance",
	"ui.could_not_open_this_syllabus_d06b9d": "Could not open this syllabus.",
	"ui.opening_b1b853": "Opening…",
	"ui.version_2da600": "Version",
	"ui.version_03283e": "Version ",
	"ui.saved_form_not_submitted_yet_c3a777": "Saved form, not submitted yet",
	"ui.changed_since_737991": "Changed since ",
	"ui.nothing_the_faculty_member_wrote_differs_from_a512f5": "Nothing the faculty member wrote differs from ",
	"ui.opening_the_syllabus_51c75a": "Opening the syllabus…",
	"ui.open_79d37e": "Open ",
	"ui.uploaded_syllabus_73f85b": "Uploaded syllabus",
	"ui.review_e29a79": "Review",
	"ui.profile_photo_updated_3d7ef0": "Profile photo updated.",
	"ui.could_not_update_your_photo_78f1fc": "Could not update your photo.",
	"ui.profile_photo_removed_1e6a07": "Profile photo removed.",
	"ui.could_not_remove_your_photo_ed1d1f": "Could not remove your photo.",
	"ui.syllabus_management_system_e49cab": "SYLLABUS MANAGEMENT SYSTEM",
	"ui.search_syllabus_course_faculty_67a24a": "Search syllabus, course, faculty...",
	"ui.messages_p0_unread_f09423": "Messages, {p0} unread",
	"ui.unread_2630a7": " unread",
	"ui.no_conversations_yet_265928": "No conversations yet.",
	"ui.notifications_753a22": "Notifications",
	"ui.notifications_p0_unread_5c2cb7": "Notifications, {p0} unread",
	"ui.mark_all_read_8958e2": "Mark all read",
	"ui.all_caught_up_47cbaf": "All caught up",
	"ui.no_notifications_yet_5537c6": "No notifications yet.",
	"ui.unknown_role_476868": "Unknown role",
	"ui.profile_photo_33f385": "Profile photo",
	"ui.change_photo_ed5690": "Change photo",
	"ui.remove_photo_c8f5ed": "Remove photo",
	"ui.log_out_6e78c9": "Log out",
	"ui.mapped_outcomes_f695cc": "Mapped outcomes: ",
	"ui.could_not_load_the_history_8efe8d": "Could not load the history.",
	"ui.version_history_91f865": "Version history",
	"ui.version_history_6974ab": "Version History",
	"ui.loading_history_02cb12": "Loading history…",
	"ui.no_versions_recorded_yet_a3a752": "No versions recorded yet.",
	"ui.every_version_that_was_submitted_is_kept_and_none_is_ever_changed_24fa9a": "Every version that was submitted is kept, and none is ever changed. Open one to read it as it was.",
	"ui.current_4fc0e2": "Current",
	"ui.changed_since_the_version_before_01d3f5": "Changed since the version before: ",
	"ui.changed_8d443e": "Changed: ",
	"ui.by_876074": " by ",
	"ui.on_bac8e7": " on ",
	"ui.download_file_774025": "Download file",
	"ui.view_version_1109c5": "View version ",
	"ui.the_compliance_check_is_in_step_7_of_the_syllabus_builder_1f3135": "The compliance check is in step 7 of the Syllabus Builder.",
	"ui.ai_syllabus_checker_0c99c9": "AI Syllabus Checker",
	"ui.check_each_submitted_syllabus_against_the_template_the_result_is__703bf5": "Check each submitted syllabus against the template. The result is stored with the version a reviewer sees. Current method: ",
	"ui.compliance_checks_are_not_set_up_on_this_server_yet_ask_an_admini_815abc": "Compliance checks are not set up on this server yet. Ask an administrator to run the database update; until then nothing is stored.",
	"ui.the_check_supports_but_does_not_replace_faculty_curriculum_commit_e24080": "The check supports — but does not replace — faculty, curriculum committee, and academic quality review.",
	"ui.mar_c4ba08": "Mar",
	"ui.apr_befde5": "Apr",
	"ui.may_c94f47": "May",
	"ui.jun_6d90df": "Jun",
	"ui.jul_b73755": "Jul",
	"ui.aug_75629a": "Aug",
	"ui.high_80_100_234a35": "High (80–100%)",
	"ui.medium_50_79_d47c66": "Medium (50–79%)",
	"ui.low_50_979304": "Low (<50%)",
	"ui.10_years_cf5ed9": "≤ 10 years",
	"ui.0_5_years_56523b": "0–5 years",
	"ui.6_10_years_4da687": "6–10 years",
	"ui.10_years_86387f": ">10 years",
	"ui.my_analytics_1ab328": "My Analytics",
	"ui.analytics_quality_dashboard_b85172": "Analytics & Quality Dashboard",
	"ui.track_your_personal_compliance_scores_and_submission_performance_b66964": "Track your personal compliance scores and submission performance.",
	"ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463": "Monitor compliance, curriculum coverage, submission performance, and syllabus quality trends.",
	"ui.ay_2026_2027_830f3e": "AY 2026–2027",
	"ui.ay_2025_2026_8b00a8": "AY 2025–2026",
	"ui.download_report_9f36e2": "⇩ Download Report",
	"ui.compliance_trend_2fa4a1": "Compliance Trend",
	"ui.your_ai_compliance_score_over_time_f2f70b": "Your AI compliance score over time",
	"ui.average_ai_compliance_score_603cf2": "Average AI compliance score",
	"ui.outcome_coverage_5788ff": "Outcome Coverage",
	"ui.your_syllabus_coverage_b60846": "Your syllabus coverage",
	"ui.coverage_across_approved_syllabi_923a95": "Coverage across approved syllabi",
	"ui.submission_completion_b3968d": "Submission Completion",
	"ui.your_submissions_e58b57": "Your submissions",
	"ui.by_program_11a420": "By program",
	"ui.reference_currency_7c7576": "Reference Currency",
	"ui.age_of_cited_learning_resources_2711b5": "Age of cited learning resources",
	"ui.quality_dimensions_41c80b": "Quality Dimensions",
	"ui.your_quality_scores_8f5d5e": "Your quality scores",
	"ui.average_percentage_scores_by_program_3c980a": "Average percentage scores by program",
	"ui.actionable_insights_9816fd": "Actionable Insights",
	"ui.tips_for_your_submissions_76ea2a": "Tips for your submissions",
	"ui.ai_generated_quality_observations_82b3fd": "AI-generated quality observations",
	"ui.assignments_saved_for_p0_p1_c93ea6": "Assignments saved for {p0} {p1}.",
	"ui.failed_9500be": "Failed: ",
	"ui.assignments_057d58": "Assignments",
	"ui.could_not_load_the_assignments_7525d7": "Could not load the assignments: ",
	"ui.programs_ab14d0": "Programs",
	"ui.programs_bbc93f": "Programs ",
	"ui.of_607f2d": " of ",
	"ui.assigned_cb6e65": " assigned",
	"ui.assign_f1e181": "Assign ",
	"ui.to_3a59c4": " to ",
	"ui.no_programs_exist_yet_f41802": "No programs exist yet.",
	"ui.tick_a_program_to_assign_it_the_count_is_subjects_assigned_out_of_6c6499": "Tick a program to assign it. The count is subjects assigned out of subjects in the catalog.",
	"ui.subjects_of_08ca3f": "Subjects of ",
	"ui.subjects_278947": "Subjects",
	"ui.choose_a_program_to_see_its_subjects_bf5ee2": "Choose a program to see its subjects.",
	"ui.select_all_913aff": "Select all",
	"ui.clear_719ea3": "Clear",
	"ui.is_not_assigned_to_914cca": " is not assigned to ",
	"ui.yet_tick_it_on_the_left_to_assign_its_subjects_you_can_still_add__b0b1ca": " yet. Tick it on the left to assign its subjects. You can still add subjects to the catalog in Program & Subjects.",
	"ui.search_736a49": "Search ",
	"ui.subjects_4ad212": " subjects",
	"ui.search_subjects_45c4dd": "Search subjects",
	"ui.assigned_e24e82": "Assigned",
	"ui.code_adac69": "Code",
	"ui.title_768e0c": "Title",
	"ui.no_subject_matches_your_search_d6a180": "No subject matches your search.",
	"ui.no_subjects_in_662f89": "No subjects in ",
	"ui.yet_add_them_in_subjects_amp_clos_then_assign_them_here_5ddd30": " yet. Add them in Subjects & CLOs, then assign them here.",
	"ui.go_to_subjects_amp_clos_c825d0": "Go to Subjects & CLOs",
	"ui.program_c2e68c": " program",
	"ui.subject_5983be": " subject",
	"ui.save_assignments_710200": "Save assignments",
	"ui.used_by_f5060a": "Used by",
	"ui.clo_069efc": "CLO ",
	"ui.vision_and_mission_4c8752": "Vision and mission",
	"ui.vision_40b090": "Vision",
	"ui.mission_e4698d": "Mission",
	"ui.expected_graduate_attributes_86f980": "Expected graduate attributes",
	"ui.program_outcomes_b86d07": "Program outcomes · ",
	"ui.ega_4f085b": "EGA ",
	"ui.po_3756d6": "PO ",
	"ui.ega_7bee0f": "[EGA ",
	"ui.no_program_outcomes_are_loaded_for_db8e64": "No program outcomes are loaded for ",
	"ui.an_administrator_adds_them_in_institution_settings_ddb051": ". An administrator adds them in institution settings.",
	"ui.choose_a_program_in_step_1_to_load_its_program_outcomes_d121f2": "Choose a program in step 1 to load its program outcomes.",
	"ui.the_badges_show_which_of_the_course_learning_outcomes_use_each_at_6463d4": "The badges show which of the course learning outcomes use each attribute or outcome. Point at a CLO below to highlight what it is tagged to.",
	"ui.course_learning_outcomes_503861": "Course learning outcomes",
	"ui.choose_a_subject_in_step_1_to_load_its_learning_outcomes_017d6f": "Choose a subject in step 1 to load its learning outcomes.",
	"ui.no_learning_outcomes_are_defined_for_abd5b1": "No learning outcomes are defined for ",
	"ui.yet_an_administrator_adds_them_in_subjects_amp_clos_2e8b78": " yet. An administrator adds them in Subjects & CLOs.",
	"ui.none_6eef66": "None",
	"ui.program_outcomes_858de9": "Program outcomes",
	"ui.clo_numbers_follow_the_order_in_the_subject_catalog_in_step_3_you_bbf7d3": "CLO numbers follow the order in the subject catalog. In step 3 you tag each ILO with the CLOs, EGAs and program outcomes it builds.",
	"ui.compliance_check_cf2d1e": "Compliance check",
	"ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a": "Checked against the Undergraduate Syllabus form. Only a form that does not follow the template stops you from submitting; the score and the other findings are advice for you and the reviewer.",
	"ui.re_check_9cf055": "Re-check",
	"ui.compliance_checks_are_not_available_on_this_server_yet_you_can_st_d6b109": "Compliance checks are not available on this server yet. You can still submit.",
	"ui.checking_your_syllabus_1278c5": "Checking your syllabus…",
	"ui.not_checked_yet_8ea64e": "Not checked yet.",
	"ui.component_c92c52": "Component",
	"ui.abbr_b9bce8": "abbr",
	"ui.abbreviation_cd4378": "Abbreviation",
	"ui.percent_dff0eb": " percent",
	"ui.remove_component_200c43": "Remove component",
	"ui.add_component_2364b5": "+ Add component",
	"ui.weights_cd9b0c": "Weights: ",
	"ui.total_b25928": "Total",
	"ui.should_be_100_655251": "should be 100%",
	"ui.final_rating_lists_29eda9": "Final rating lists ",
	"ui.of_3_terms_add_the_missing_exam_rows_in_step_3_694862": " of 3 terms. Add the missing exam rows in step 3.",
	"ui.final_rating_is_built_from_your_496f08": "Final rating is built from your ",
	"ui.exam_rows_db6139": " exam rows.",
	"ui.write_the_formulas_myself_8320f5": "Write the formulas myself ",
	"ui.term_grade_2e36c7": "Term grade",
	"ui.final_rating_26f0fa": "Final rating",
	"ui.loading_the_syllabus_builder_e89b32": "Loading the syllabus builder...",
	"ui.could_not_open_the_builder_7169ab": "Could not open the builder: ",
	"ui.could_not_load_that_subject_8e9791": "Could not load that subject: ",
	"ui.could_not_save_your_changes_check_your_connection_and_try_again_17b0b0": "Could not save your changes. Check your connection and try again.",
	"ui.choose_a_subject_first_24357e": "Choose a subject first.",
	"ui.upload_failed_31c949": "Upload failed: ",
	"ui.syllabus_builder_editor_ac6179": "Syllabus Builder / Editor",
	"ui.fill_in_the_institutional_syllabus_form_step_by_step_every_part_i_35903f": "Fill in the institutional syllabus form step by step. Every part is connected to the others.",
	"ui.save_now_3989b7": "Save now",
	"ui.how_to_submit_0e4bbb": "How to submit",
	"ui.fill_in_the_form_e4aa1f": "Fill in the form",
	"ui.upload_a_file_instead_eaad9b": "Upload a file instead",
	"ui.course_code_9c9dad": "Course Code",
	"ui.course_title_265cd6": "Course Title",
	"ui.school_year_ec856b": "School Year",
	"ui.status_bae7d5": "Status",
	"ui.steps_cdde4f": "Steps",
	"ui.finish_step_316523": "Finish step ",
	"ui.first_faeaef": " first",
	"ui.locked_adec79": "locked",
	"ui.complete_0737c2": "complete",
	"ui.needs_attention_3ad98d": "needs attention",
	"ui.complete_f37486": " complete",
	"ui.you_can_read_this_syllabus_but_not_change_it_until_an_administrat_4f4ecd": " You can read this syllabus, but not change it until an administrator assigns the course to you again.",
	"ui.returned_for_revision_d2426a": "Returned for revision.",
	"ui.your_next_submission_becomes_d37d36": " Your next submission becomes ",
	"ui.once_you_change_something_b3eaf9": " once you change something; ",
	"ui.and_every_earlier_version_stay_in_the_history_f8dfa6": " and every earlier version stay in the history.",
	"ui.reviewer_s_note_573dfd": "Reviewer's note: ",
	"ui.step_c5964d": "STEP ",
	"ui.of_f69649": " OF ",
	"ui.retry_9f5cd8": "Retry",
	"ui.finish_the_steps_marked_in_the_list_review_check_the_compliance_c_31bb82": "Finish the steps marked ! in the list. Review & Check: the compliance check and ",
	"ui.saving_a_new_version_a8d794": "saving a new version",
	"ui.submitting_8ee0db": "submitting",
	"ui.unlock_once_steps_1_to_6_are_complete_f983eb": " unlock once steps 1 to 6 are complete.",
	"ui.to_continue_3819bf": "To continue:",
	"ui.this_step_cannot_be_completed_yet_d2c256": "This step cannot be completed yet.",
	"ui.check_again_e18504": "Check again",
	"ui.in_the_compliance_check_they_do_not_block_you_the_reviewer_will_s_d35203": " in the compliance check. They do not block you: the reviewer will see them, so fix what you can first.",
	"ui.suggestions_73fedd": "Suggestions: ",
	"ui.complete_this_step_to_continue_71b565": "Complete this step to continue",
	"ui.next_94377f": "Next: ",
	"ui.run_the_compliance_check_again_49661e": "Run the compliance check again",
	"ui.complete_steps_1_to_6_to_unlock_b21a68": "Complete steps 1 to 6 to unlock",
	"ui.say_what_you_changed_a_sentence_first_01ece1": "Say what you changed (a sentence) first",
	"ui.program_2f03bb": "Program *",
	"ui.choosing_a_program_loads_its_program_outcomes_into_step_2_9e3350": "Choosing a program loads its program outcomes into step 2.",
	"ui.loads_7a0d36": "Loads ",
	"ui.program_outcomes_9989b2": " program outcomes",
	"ui.into_step_2_cd03a4": " into step 2.",
	"ui.no_program_outcomes_loaded_for_23e032": "No program outcomes loaded for ",
	"ui.yet_an_administrator_adds_them_a9bb24": " yet. An administrator adds them.",
	"ui.subject_i_ii_0cd15b": "Subject * (I, II)",
	"ui.choose_a_program_first_43fce3": "Choose a program first",
	"ui.no_subjects_yet_1e06ee": "No subjects yet",
	"ui.subjects_are_listed_by_program_41c330": "Subjects are listed by program.",
	"ui.the_subject_sets_the_code_title_and_learning_outcomes_632d3c": "The subject sets the code, title and learning outcomes.",
	"ui.no_subjects_have_been_added_for_679751": "No subjects have been added for ",
	"ui.its_code_title_and_learning_outcomes_load_from_the_subject_cecbb5": "Its code, title and learning outcomes load from the subject.",
	"ui.credit_units_v_40ba2a": "Credit units * (V)",
	"ui.lecture_units_de9aaf": "Lecture units",
	"ui.units_lecture_2a1d2c": "units lecture /",
	"ui.laboratory_units_067e02": "Laboratory units",
	"ui.unit_laboratory_60e5a6": "unit laboratory",
	"ui.pre_requisite_iv_1c46d5": "Pre-requisite (IV)",
	"ui.pre_requisite_d4ec8c": "Pre-requisite",
	"ui.course_description_iii_db7708": "Course description * (III)",
	"ui.describe_the_course_in_a_few_sentences_8c883c": "Describe the course in a few sentences",
	"ui.description_paragraph_207be8": "Description paragraph ",
	"ui.remove_paragraph_4bf624": "Remove paragraph",
	"ui.add_paragraph_8df913": "+ Add paragraph",
	"ui.course_code_c3a63c": "Course code ",
	"ui.course_title_b609b8": "Course title ",
	"ui.school_year_fa59aa": "School year ",
	"ui.college_ef33db": "College ",
	"ui.text_c3328c": "Text",
	"ui.remove_1680e3": "Remove ",
	"ui.tag_outcomes_9af691": "Tag outcomes",
	"ui.search_by_name_or_number_63632c": "Search by name or number",
	"ui.search_outcomes_3d2fd6": "Search outcomes",
	"ui.nothing_matches_019f8e": "Nothing matches ",
	"ui.clo_coverage_98ba99": "CLO coverage",
	"ui.untitled_621521": "Untitled",
	"ui.week_a4779a": " week",
	"ui.row_9867f6": " row",
	"ui.not_covered_yet_3a7d66": "Not covered yet",
	"ui.wk_1_474a85": "wk 1",
	"ui.showing_85a4af": "Showing ",
	"ui.rows_that_build_fd23e7": " rows that build",
	"ui.clear_filter_b667d6": "Clear filter",
	"ui.of_18_7cd558": " of 18",
	"ui.weeks_covered_use_f7d2f0": " weeks covered. Use ",
	"ui.for_bullets_and_58b7a5": " for bullets and ",
	"ui.bold_40b7d4": "**bold**",
	"ui.for_labels_b0d83a": " for labels.",
	"ui.cell_view_163f49": "Cell view",
	"ui.edit_530164": "Edit",
	"ui.formatted_f26356": "Formatted",
	"ui.week_f82be6": "Week",
	"ui.intended_learning_outcomes_7e7669": "Intended learning outcomes",
	"ui.course_contents_1b687b": "Course contents",
	"ui.learning_activities_87fc76": "Learning activities",
	"ui.assessment_tasks_795936": "Assessment tasks",
	"ui.values_to_integrate_bf0acd": "Values to integrate",
	"ui.wk_1e49a0": "Wk ",
	"ui.row_type_91d899": "Row type",
	"ui.lesson_0bb7c8": "LESSON",
	"ui.exam_c7e542": "EXAM",
	"ui.move_up_b4f57c": "Move up",
	"ui.move_down_260ff8": "Move down",
	"ui.duplicate_row_d66d5f": "Duplicate row",
	"ui.delete_row_fcf3f8": "Delete row",
	"ui.review_of_topics_235cbc": "Review of topics",
	"ui.review_topics_520343": "Review topics",
	"ui.ilo_080517": "ILO",
	"ui.start_with_a_verb_6b1d63": "Start with a verb",
	"ui.ilo_f12fa1": "ILO ",
	"ui.of_week_60075b": " of week ",
	"ui.tag_outcomes_for_ilo_5f768a": "Tag outcomes for ILO ",
	"ui.tag_eae765": "+ Tag",
	"ui.remove_ilo_4d0e7b": "Remove ILO",
	"ui.ilo_b41960": "+ ILO",
	"ui.no_rows_build_this_clo_yet_tag_an_ilo_with_it_or_clear_the_filter_f917f8": "No rows build this CLO yet. Tag an ILO with it, or clear the filter.",
	"ui.no_rows_yet_a2e4b6": "No rows yet.",
	"ui.add_week_3a833d": "+ Add week",
	"ui.add_exam_row_19d3c0": "+ Add exam row",
	"ui.not_applicable_67c4d0": "Not applicable",
	"ui.marked_not_applicable_for_this_course_b1c227": "Marked not applicable for this course.",
	"ui.reference_db1c78": "Reference",
	"ui.reference_523d48": " reference ",
	"ui.more_than_10_years_older_than_school_year_0390a8": "More than 10 years older than school year ",
	"ui.yrs_a00f7d": " yrs",
	"ui.remove_reference_629558": "Remove reference",
	"ui.add_reference_081ae6": "+ Add reference",
	"ui.requirement_e9c366": "Requirement",
	"ui.requirement_15c842": "Requirement ",
	"ui.remove_requirement_425573": "Remove requirement",
	"ui.add_requirement_a73fac": "+ Add requirement",
	"ui.enter_adds_the_next_line_10a028": " Enter adds the next line.",
	"ui.from_your_assessment_tasks_in_step_3_860593": "From your assessment tasks in step 3",
	"ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3": "The server did not accept this submit. Fix these first:",
	"ui.step_status_dc70c2": "Step status",
	"ui.and_97e211": "and ",
	"ui.more_84b30f": " more",
	"ui.sign_off_91a02d": "Sign-off",
	"ui.prepared_by_47b758": "Prepared by",
	"ui.from_your_account_870e41": ", from your account",
	"ui.checked_and_reviewed_by_e4719b": "Checked and reviewed by",
	"ui.added_by_the_system_on_review_24a39a": "Added by the system on review",
	"ui.approved_by_b95366": "Approved by",
	"ui.added_by_the_system_on_approval_9614af": "Added by the system on approval",
	"ui.the_other_names_and_the_revision_date_are_added_by_the_system_whe_0aa097": "The other names and the revision date are added by the system when the syllabus is reviewed and approved. You do not fill them in.",
	"ui.what_did_you_change_required_c57040": "What did you change? (required)",
	"ui.what_changed_optional_8668e0": "What changed? (optional)",
	"ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9": "Saved with this version in the history, e.g. Updated the grading components",
	"ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338": "Write at least a sentence so the reviewer knows what to look at.",
	"ui.only_pdf_files_are_accepted_b07af1": "Only PDF files are accepted.",
	"ui.that_file_is_larger_than_10mb_1b3a23": "That file is larger than 10MB.",
	"ui.upload_a_file_db7dd1": "UPLOAD A FILE",
	"ui.submit_your_syllabus_as_a_pdf_b41730": "Submit your syllabus as a PDF",
	"ui.use_this_when_your_syllabus_is_already_finished_the_pdf_is_what_r_cf6dfc": "Use this when your syllabus is already finished. The PDF is what reviewers will read, so the form is not needed.",
	"ui.choose_the_subject_first_so_the_syllabus_is_filed_under_the_right_54e15b": " Choose the subject first, so the syllabus is filed under the right course.",
	"ui.choose_it_in_the_form_c92099": "Choose it in the form",
	"ui.click_or_drop_to_replace_95d96b": " • Click or drop to replace",
	"ui.drag_and_drop_your_syllabus_here_or_click_to_choose_5b8cda": "Drag and drop your syllabus here, or click to choose",
	"ui.pdf_only_max_10mb_daa870": "PDF only • Max 10MB",
	"ui.preview_f1fbb2": "Preview",
	"ui.open_in_a_new_tab_b22f39": "Open in a new tab",
	"ui.preview_of_the_selected_pdf_1b26e7": "Preview of the selected PDF",
	"ui.note_for_the_reviewer_optional_201228": "Note for the reviewer (optional)",
	"ui.anything_the_reviewer_should_know_344e5b": "Anything the reviewer should know",
	"ui.this_file_will_be_submitted_as_your_syllabus_anything_you_filled__2684db": "This file will be submitted as your syllabus. Anything you filled in on the form is kept as a draft, but it is not submitted.",
	"ui.uploading_d921a7": "Uploading…",
	"ui.upload_as_new_version_77fd0e": "Upload as new version",
	"ui.submit_for_review_f7710d": "Submit for review",
	"ui.loading_comments_a1458a": "Loading comments…",
	"ui.no_comments_yet_207b24": "No comments yet.",
	"ui.reviewer_a74f16": "Reviewer",
	"ui.new_6403f2": "New",
	"ui.add_a_comment_for_the_faculty_member_3f0231": "Add a comment for the faculty member…",
	"ui.new_comment_af65ae": "New comment",
	"ui.adding_ffb2e6": "Adding…",
	"ui.add_comment_7d3764": "Add comment",
	"ui.faculty_compliance_monitoring_7b4446": "Faculty Compliance Monitoring",
	"ui.track_syllabus_submission_compliance_per_faculty_member_for_pacuc_a8b5e5": "Track syllabus submission compliance per faculty member for PACUCOA accreditation.",
	"ui.approved_4f3fcf": " approved • ",
	"ui.under_review_bfad2e": " under review",
	"ui.compliant_c584a3": "Compliant",
	"ui.non_compliant_6d126a": "Non-compliant",
	"ui.required_0e7f72": " required",
	"ui.missing_09a3b7": "⚠ Missing ",
	"ui.required_syllabus_submissions_2992e9": " required syllabus submissions",
	"ui.checked_by_an_administrator_2cf77d": "Checked by an administrator",
	"ui.out_of_date_the_syllabus_changed_after_this_check_384297": "Out of date: the syllabus changed after this check",
	"ui.standard_f00ef0": "Standard ",
	"ui.checked_e3b884": " · checked ",
	"ui.contact_hours_a41bbd": "Contact hours: ",
	"ui.a_week_about_47d819": " a week, about ",
	"ui.for_the_term_the_plan_covers_825f4f": " for the term. The plan covers ",
	"ui.weeks_ff9807": " weeks.",
	"ui.on_track_464e43": "on track",
	"ui.needs_work_def443": "needs work",
	"ui.not_scored_4e720d": "not scored",
	"ui.these_stop_the_syllabus_from_being_submitted_cff5cf": "These stop the syllabus from being submitted:",
	"ui.recommendations_4faa65": "Recommendations",
	"ui.nothing_to_improve_every_check_passed_60de97": "Nothing to improve: every check passed.",
	"ui.behind_the_score_db725f": " behind the score",
	"ui.rule_blocks_submit_a7fc69": "Rule · blocks submit",
	"ui.rule_78e179": "Rule",
	"ui.year_8cad48": " — Year ",
	"ui.course_outcomes_a04e0d": "Course Outcomes",
	"ui.po_eea0c0": "PO",
	"ui.could_not_load_subjects_16ddd6": "Could not load subjects: ",
	"ui.program_p0_created_and_subject_added_add_its_outcomes_below_a9b6e2": "Program {p0} created and subject added. Add its outcomes below.",
	"ui.subject_added_add_its_learning_outcomes_below_ad8a1c": "Subject added. Add its learning outcomes below.",
	"ui.program_subjects_904de5": "Program & Subjects",
	"ui.open_a_subject_to_manage_its_program_s_graduate_attributes_and_pr_048ac5": "Open a subject to manage its program's graduate attributes and program outcomes, its course learning outcomes, and the school's vision and mission. Faculty see them read-only in the syllabus builder.",
	"ui.add_subject_cf1347": "+ Add subject",
	"ui.program_code_18ae83": "Program code",
	"ui.e_g_bsit_a78cbf": "e.g. BSIT",
	"ui.existing_program_fa9fac": "Existing program",
	"ui.is_a_new_program_and_will_be_created_with_this_subject_d5fa10": " is a new program and will be created with this subject.",
	"ui.program_name_699413": "Program name",
	"ui.e_g_bs_information_technology_898182": "e.g. BS Information Technology",
	"ui.subject_code_8e42db": "Subject code",
	"ui.e_g_it_204_a373a7": "e.g. IT 204",
	"ui.subject_title_dce28f": "Subject title",
	"ui.add_subject_f3ceb3": "Add subject",
	"ui.filter_by_program_133f8f": "Filter by program",
	"ui.all_programs_982d52": "All programs",
	"ui.clos_a33483": "CLOs",
	"ui.missing_276f5d": "Missing: ",
	"ui.setup_incomplete_7eeb25": "Setup incomplete",
	"ui.no_subjects_in_p0_yet_4d9c7b": "No subjects in {p0} yet.",
	"ui.no_subjects_yet_add_one_to_start_c6c29e": "No subjects yet. Add one to start.",
	"ui.welcome_back_1c5b34": "Welcome back!",
	"ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17": "Here's what is happening with your undergraduate syllabi.",
	"ui.new_syllabus_c4c7a9": "+ New Syllabus",
	"ui.recent_activity_8aebf3": "Recent Activity",
	"ui.clear_logs_7c3089": "Clear Logs",
	"ui.clear_your_activity_from_this_list_nothing_is_deleted_it_only_hid_fb5d0d": "Clear your activity from this list? Nothing is deleted: it only hides what you did up to now.",
	"ui.nothing_yet_what_you_upload_submit_and_update_appears_here_f8bbff": "Nothing yet. What you upload, submit and update appears here.",
	"ui.nothing_yet_your_reviews_and_decisions_appear_here_6bd686": "Nothing yet. Your reviews and decisions appear here.",
	"ui.submission_status_12db71": "Submission Status",
	"ui.approved_41b81e": "Approved",
	"ui.submitted_2e0035": "Submitted",
	"ui.under_review_18afed": "Under Review",
	"ui.for_revision_d7500c": "For Revision",
	"ui.quick_actions_c40810": "Quick Actions",
	"ui.check_a_syllabus_f9c218": "Check a syllabus",
	"ui.compliance_overview_f4109d": "Compliance overview",
	"ui.run_the_compliance_check_in_step_7_of_the_builder_d861f3": "Run the compliance check in step 7 of the builder",
	"ui.read_the_stored_check_of_each_submitted_syllabus_921a70": "Read the stored check of each submitted syllabus",
	"ui.my_syllabi_3da1e8": "My Syllabi",
	"ui.syllabi_in_your_account_732cf8": " syllabi in your account",
	"ui.review_pending_syllabi_bf50c2": "Review Pending Syllabi",
	"ui.submissions_awaiting_review_31080a": " submissions awaiting review",
	"ui.program_compliance_943fac": "Program Compliance",
	"ui.no_program_data_yet_c5b890": "No program data yet.",
	"ui.ai_quality_snapshot_c296aa": "AI Quality Snapshot",
	"ui.format_041a5d": "Format",
	"ui.completeness_778184": "Completeness",
	"ui.co_po_9c8106": "CO–PO",
	"ui.assessment_ef136f": "Assessment",
	"ui.upcoming_deadlines_b56518": "Upcoming Deadlines",
	"ui.department_syllabus_submission_e11d1e": "Department syllabus submission",
	"ui.5_days_remaining_8ac5f5": "5 days remaining",
	"ui.program_chair_review_deadline_31a12f": "Program chair review deadline",
	"ui.12_days_remaining_650a54": "12 days remaining",
	"ui.dean_approval_deadline_addb1a": "Dean approval deadline",
	"ui.18_days_remaining_fdeccb": "18 days remaining",
	"ui.view_and_manage_your_submitted_syllabi_06426e": "View and manage your submitted syllabi.",
	"ui.you_can_create_a_syllabus_once_a_subject_is_assigned_to_you_b8383e": " You can create a syllabus once a subject is assigned to you.",
	"ui.updated_c95815": "Updated ",
	"ui.open_the_reviewer_comments_1c484a": "Open the reviewer comments",
	"ui.edit_79cae4": "✎ Edit",
	"ui.notes_from_your_reviewer_about_this_syllabus_6ace96": "Notes from your reviewer about this syllabus",
	"ui.comments_e445b9": "▤ Comments",
	"ui.new_7cebfd": " new",
	"ui.in_total_ed532f": " in total",
	"ui.a_conversation_with_your_reviewer_0032bd": "A conversation with your reviewer",
	"ui.message_890761": "✉ Message",
	"ui.history_fefbcc": "◷ History",
	"ui.delete_p0_b3e049": "Delete {p0}",
	"ui.delete_syllabus_db7e53": "Delete Syllabus?",
	"ui.are_you_sure_you_want_to_delete_p0_this_cannot_be_undone_efea10": "Are you sure you want to delete {p0}? This cannot be undone.",
	"ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9": "No syllabi yet. Click \"+ New Syllabus\" to get started.",
	"ui.report_downloaded_c0e45e": "Report downloaded.",
	"ui.reports_88bc3f": "Reports",
	"ui.generate_compliance_accreditation_and_historical_reports_for_inst_673ed4": "Generate compliance, accreditation, and historical reports for institutional review.",
	"ui.faculty_compliance_report_91eba7": "Faculty Compliance Report",
	"ui.download_e4d296": "⇩ Download",
	"ui.computed_from_live_syllabus_data_5e6cfe": "Computed from live syllabus data.",
	"ui.total_9ac1f4": " total",
	"ui.approved_cd0fee": " approved",
	"ui.accreditation_audit_summary_aa0020": "Accreditation & Audit Summary",
	"ui.total_syllabi_6ef623": "Total Syllabi",
	"ui.compliance_68f0ae": "Compliance",
	"ui.pacucoa_accreditation_report_generated_for_institutional_complian_60dc81": "PACUCOA Accreditation Report — generated for institutional compliance review.",
	"ui.historical_exports_5581a0": "Historical Exports",
	"ui.preparing_download_demo_089194": "Preparing download (demo).",
	"ui.semester_1_final_compliance_xlsx_df9ccf": "📄 Semester_1_Final_Compliance.xlsx ⇩",
	"ui.ched_regional_alignment_report_pdf_f98de5": "📄 CHED_Regional_Alignment_Report.pdf ⇩",
	"ui.department_audit_q4_pdf_3d917b": "📄 Department_Audit_Q4.pdf ⇩",
	"ui.syllabus_repository_95d8eb": "Syllabus Repository",
	"ui.search_and_access_your_syllabi_approved_by_an_administrator_112b87": "Search and access your syllabi approved by an administrator.",
	"ui.search_and_access_current_and_archived_syllabus_versions_across_u_c4cc77": "Search and access current and archived syllabus versions across undergraduate programs.",
	"ui.repository_export_prepared_demo_02ceb3": "Repository export prepared (demo).",
	"ui.export_list_b039ae": "⇩ Export List",
	"ui.all_6a7208": "All",
	"ui.search_bce064": "Search",
	"ui.course_code_title_or_faculty_1878e5": "Course code, title or faculty",
	"ui.approved_afd61f": "Approved ",
	"ui.all_255db9": "All ",
	"ui.course_d82b56": "Course",
	"ui.updated_f2f857": "Updated",
	"ui.actions_c3cd63": "Actions",
	"ui.open_chat_for_p0_633dd9": "Open chat for {p0}",
	"ui.view_history_for_p0_46396f": "View history for {p0}",
	"ui.unable_to_load_approved_syllabi_cd0cc5": "Unable to load approved syllabi: ",
	"ui.loading_approved_syllabi_3ad229": "Loading approved syllabi…",
	"ui.no_approved_syllabi_yet_your_syllabus_will_appear_here_once_an_ad_b167c3": "No approved syllabi yet. Your syllabus will appear here once an administrator approves it.",
	"ui.no_syllabi_match_your_filters_e09598": "No syllabi match your filters.",
	"ui.review_approval_c4c871": "Review & Approval",
	"ui.open_a_submission_to_read_it_then_approve_it_return_it_for_revisi_2dbe01": "Open a submission to read it, then approve it, return it for revision, or reject it.",
	"ui.pending_b6d850": " Pending",
	"ui.waiting_for_the_ai_checker_check_37ebe7": " waiting for the AI Checker. Check ",
	"ui.there_first_then_9f79fd": " there first; then ",
	"ui.here_for_your_decision_b13f6c": " here for your decision.",
	"ui.open_the_ai_checker_ea8956": "Open the AI Checker",
	"ui.search_faculty_program_or_subject_92ad4a": "Search faculty, program or subject",
	"ui.search_the_review_board_b45456": "Search the review board",
	"ui.all_caught_up_no_pending_syllabi_88b06d": "All caught up! No pending syllabi.",
	"ui.no_syllabus_matches_ade270": "No syllabus matches “",
	"ui.could_not_load_the_program_outcomes_for_this_syllabus_a4ad37": "Could not load the program outcomes for this syllabus: ",
	"ui.loading_the_syllabus_79e1d4": "Loading the syllabus…",
	"ui.this_submission_has_not_been_checked_in_the_ai_checker_yet_check__0291cf": "This submission has not been checked in the AI Checker yet. Check it there first, then come back to read it and decide.",
	"ui.this_syllabus_is_b75bb9": "This syllabus is ",
	"ui.there_is_nothing_to_decide_e4fd66": ". There is nothing to decide.",
	"ui.note_to_the_faculty_member_07d0ce": "Note to the faculty member",
	"ui.optional_for_approval_required_to_return_for_revision_or_reject_ce4884": "Optional for approval. Required to return for revision or reject.",
	"ui.confirm_decision_a3ca00": "Confirm decision",
	"ui.confirm_04a212": "Confirm",
	"ui.revision_history_b9d26d": "Revision history",
	"ui.settings_saved_f133b2": "Settings saved.",
	"ui.could_not_update_your_profile_please_try_again_b453df": "Could not update your profile. Please try again.",
	"ui.settings_c7f73b": "Settings",
	"ui.manage_your_profile_and_preferences_effe10": "Manage your profile and preferences.",
	"ui.my_profile_9ba8d3": "My Profile",
	"ui.profile_picture_aeb837": "Profile picture",
	"ui.upload_photo_69abef": "Upload photo",
	"ui.more_profile_photo_actions_5f34f0": "More profile photo actions",
	"ui.profile_photo_actions_32a191": "Profile photo actions",
	"ui.sync_google_workspace_photo_2dd636": "Sync Google Workspace photo",
	"ui.updating_profile_f2060f": "Updating profile…",
	"ui.jpeg_png_or_webp_up_to_5_mb_7e66fd": "JPEG, PNG or WebP · Up to 5 MB",
	"ui.first_name_7e568a": "First name",
	"ui.last_name_adec36": "Last name",
	"ui.save_profile_909bf3": "Save Profile",
	"ui.edit_profile_cd280a": "Edit Profile",
	"ui.language_89b86a": "Language",
	"ui.choose_the_language_used_throughout_the_system_your_preference_is_312fa8": "Choose the language used throughout the system. Your preference is saved automatically.",
	"ui.display_language_73de4c": "Display language",
	"ui.could_not_save_your_language_preference_please_try_again_479b33": "Could not save your language preference. Please try again.",
	"ui.english_649df0": "English",
	"ui.tagalog_68ddd9": "Tagalog",
	"ui.saving_language_preference_e4f88d": "Saving language preference…",
	"ui.language_preference_saved_automatically_b4db96": "Language preference saved automatically.",
	"ui.loading_administrator_settings_ce3873": "Loading administrator settings…",
	"ui.institutional_standard_2f4462": "Institutional Standard",
	"ui.default_syllabus_template_6c0a16": "Default Syllabus Template",
	"ui.undergraduate_syllabus_v4_7600c5": "Undergraduate Syllabus v4",
	"ui.undergraduate_syllabus_v3_3225ea": "Undergraduate Syllabus v3",
	"ui.default_academic_year_9141f3": "Default Academic Year",
	"ui.default_department_86b0e7": "Default Department",
	"ui.ai_notifications_35351e": "AI & Notifications",
	"ui.ai_compliance_checking_df4d0c": "AI Compliance Checking",
	"ui.enable_automated_syllabus_quality_checks_95e692": "Enable automated syllabus quality checks.",
	"ui.strict_format_validation_8d19a0": "Strict Format Validation",
	"ui.require_all_template_sections_before_submission_f069fd": "Require all template sections before submission.",
	"ui.email_notifications_128113": "Email Notifications",
	"ui.notify_users_about_review_and_revision_updates_119ca1": "Notify users about review and revision updates.",
	"ui.saving_settings_984f7f": "Saving settings…",
	"ui.save_settings_0022a3": "Save Settings",
	"ui.student_71ad6e": "STUDENT",
	"ui.welcome_a2513b": "Welcome, ",
	"ui.loading_your_profile_f1468e": "Loading your profile...",
	"ui.unsaved_changes_292672": "Unsaved changes",
	"ui.all_changes_saved_9595b7": "All changes saved",
	"ui.this_was_changed_by_someone_else_reload_to_see_the_latest_88df1e": "This was changed by someone else. Reload to see the latest. ",
	"ui.reload_cce715": "Reload",
	"ui.vision_and_mission_saved_they_apply_to_every_program_81a32f": "Vision and mission saved. They apply to every program.",
	"ui.the_institution_s_vision_ebcc2a": "The institution's vision",
	"ui.mission_introduction_873ac6": "Mission, introduction",
	"ui.mission_introduction_8acfc4": "Mission introduction",
	"ui.programs_and_services_that_will_enable_them_to_2162c1": "... programs and services that will enable them to:",
	"ui.mission_statements_5e2923": "Mission statements",
	"ui.mission_statement_45b2a8": "Mission statement ",
	"ui.mission_statement_0ccc0c": "Mission statement",
	"ui.remove_statement_100039": "Remove statement",
	"ui.add_mission_statement_0ad1c2": "+ Add mission statement",
	"ui.p0_egas_saved_aed4ac": "{p0} EGAs saved.",
	"ui.the_number_is_fixed_once_saved_program_outcomes_and_clos_point_at_b96124": "The number is fixed once saved: program outcomes and CLOs point at it. One that is still tagged cannot be removed.",
	"ui.full_name_eeb692": "Full name",
	"ui.name_of_ega_3dfa90": "Name of EGA ",
	"ui.short_name_feb5a9": "Short name",
	"ui.short_name_of_ega_231166": "Short name of EGA ",
	"ui.remove_ega_8c32e7": "Remove EGA ",
	"ui.add_ega_270a20": "+ Add EGA",
	"ui.p0_program_outcomes_saved_7fd0a0": "{p0} program outcomes saved.",
	"ui.the_number_is_fixed_once_saved_one_that_a_subject_s_clo_is_tagged_542d3f": "The number is fixed once saved. One that a subject's CLO is tagged with cannot be removed.",
	"ui.no_program_outcomes_for_3d5a81": "No program outcomes for ",
	"ui.yet_faculty_see_an_empty_list_until_you_add_them_6295d9": " yet. Faculty see an empty list until you add them.",
	"ui.short_name_of_po_452bca": "Short name of PO ",
	"ui.statement_of_po_0182b3": "Statement of PO ",
	"ui.full_statement_0c9d6a": "Full statement",
	"ui.egas_supported_by_po_44a405": "EGAs supported by PO ",
	"ui.supports_da0eed": "Supports",
	"ui.remove_po_ffe9b3": "Remove PO ",
	"ui.add_program_outcome_cd9147": "+ Add program outcome",
	"ui.learning_outcomes_saved_faculty_see_them_the_next_time_they_open__956f63": "Learning outcomes saved. Faculty see them the next time they open the subject.",
	"ui.this_subject_has_no_learning_outcomes_yet_faculty_cannot_tag_thei_0cb03e": "This subject has no learning outcomes yet. Faculty cannot tag their ILOs until you add them.",
	"ui.level_of_clo_c01e3f": "Level of CLO ",
	"ui.move_clo_baa700": "Move CLO ",
	"ui.up_459409": " up",
	"ui.down_edbf4b": " down",
	"ui.delete_clo_3a0c81": "Delete CLO ",
	"ui.descriptor_e_g_foundational_knowledge_3cc9d7": "Descriptor, e.g. Foundational Knowledge",
	"ui.title_of_clo_04eb8b": "Title of CLO ",
	"ui.statement_of_clo_13551f": "Statement of CLO ",
	"ui.what_students_will_be_able_to_do_b7a91b": "What students will be able to do",
	"ui.ega_10b364": "+ EGA",
	"ui.po_279301": "+ PO",
	"ui.the_program_outcomes_you_chose_support_de50e2": "The program outcomes you chose support ",
	"ui.ega_aa8fbe": "+ EGA ",
	"ui.add_clo_0485ad": "+ Add CLO",
	"ui.subject_saved_9c680c": "Subject saved.",
	"ui.subject_deleted_688bd2": "Subject deleted.",
	"ui.subject_details_9e2fb9": "Subject details",
	"ui.delete_this_subject_95c760": "Delete this subject",
	"ui.could_not_reload_6fda26": "Could not reload: ",
	"ui.vision_mission_graduate_attributes_program_outcomes_and_course_le_8288c7": "Vision, mission, graduate attributes, program outcomes and course learning outcomes. Faculty see them read-only in the syllabus builder.",
	"ui.setup_incomplete_2c31f4": "Setup incomplete.",
	"ui.faculty_cannot_finish_the_learning_outcomes_step_or_submit_a_syll_e79eee": " Faculty cannot finish the Learning Outcomes step, or submit a syllabus for this subject, until these are added: ",
	"ui.could_not_open_the_subject_feb4d2": "Could not open the subject: ",
	"ui.each_section_saves_on_its_own_c077f8": "Each section saves on its own.",
	"ui.course_code_e3df14": "Course Code *",
	"ui.course_title_9dfea6": "Course Title *",
	"ui.bsit_7d8d4f": "BSIT",
	"ui.bsis_fba0a3": "BSIS",
	"ui.bscs_ee67dc": "BSCS",
	"ui.blis_dcf8c9": "BLIS",
	"ui.bsemc_3a4792": "BSEMC",
	"ui.semester_3ccdf6": "Semester *",
	"ui.course_category_44003b": "Course Category",
	"ui.credits_bfac50": "Credits",
	"ui.contact_hours_week_703323": "Contact Hours / Week",
	"ui.course_description_3db6da": "Course Description *",
	"ui.syllabus_file_97aaca": "Syllabus File",
	"ui.drag_drop_your_syllabus_file_here_dbc47d": "Drag & drop your syllabus file here",
	"ui.ai_tip_use_measurable_action_verbs_and_align_each_outcome_with_an_ad77ff": " AI Tip: Use measurable action verbs and align each outcome with an assessable student performance.",
	"ui.co_550729": "CO",
	"ui.add_course_outcome_ef5418": "+ Add Course Outcome",
	"ui.topic_content_4891dc": "Topic / Content",
	"ui.teaching_learning_activity_16041e": "Teaching & Learning Activity",
	"ui.grading_components_631feb": "Grading Components",
	"ui.class_standing_0a97c9": "Class Standing",
	"ui.major_assessments_4d7f21": "Major Assessments",
	"ui.project_performance_96a2d4": "Project / Performance",
	"ui.passing_transmutation_cbb7dc": "Passing & Transmutation",
	"ui.configure_this_section_according_to_the_official_university_gradi_d406c5": "Configure this section according to the official university grading policy.",
	"ui.minimum_passing_percentage_95b265": "Minimum Passing Percentage",
	"ui.rounding_rule_71d575": "Rounding Rule",
	"ui.nearest_whole_number_78a5b6": "Nearest whole number",
	"ui.two_decimal_places_702af1": "Two decimal places",
	"ui.2_references_are_more_than_10_years_old_the_ai_checker_will_flag__315174": "⚠ 2 references are more than 10 years old. The AI checker will flag reference currency for review.",
	"ui.add_reference_75edb4": "+ Add Reference",
	"ui.attendance_b68931": "Attendance",
	"ui.students_are_expected_to_comply_with_university_attendance_and_ma_44694a": "Students are expected to comply with university attendance and make-up policies.",
	"ui.academic_integrity_e62c79": "Academic Integrity",
	"ui.all_outputs_must_observe_proper_attribution_ethical_use_of_ai_too_11d355": "All outputs must observe proper attribution, ethical use of AI tools, and academic honesty.",
	"ui.data_privacy_fd595e": "Data Privacy",
	"ui.datasets_containing_personal_information_must_be_handled_accordin_845581": "Datasets containing personal information must be handled according to institutional privacy requirements.",
	"ui.accessibility_inclusion_0211a1": "Accessibility & Inclusion",
	"ui.reasonable_learning_accommodations_shall_be_coordinated_through_t_306100": "Reasonable learning accommodations shall be coordinated through the appropriate university office.",
	"ui.draft_saved_to_this_browser_ecd4c5": "Draft saved to this browser.",
	"ui.file_attached_p0_0b74e7": "File attached: {p0}",
	"ui.create_a_standards_aligned_syllabus_using_a_guided_institutional__8a7040": "Create a standards-aligned syllabus using a guided institutional template.",
	"ui.save_draft_cc1316": "Save Draft",
	"ui.preview_generated_demo_a76695": "Preview generated (demo).",
	"ui.submit_for_review_123f6c": "Submit for Review",
	"ui.semester_788454": "Semester",
	"ui.draft_23d33e": "Draft",
	"ui.this_syllabus_is_under_review_be53e1": "This syllabus is under review. ",
	"ui.your_changes_are_saved_as_a_new_version_552d76": "Your changes are saved as a new version (",
	"ui.current_405ab5": "current",
	"ui.stays_in_the_history_2340b8": " stays in the history)",
	"ui.and_the_reviewer_is_notified_7b40ef": " and the reviewer is notified",
	"ui.only_the_title_course_code_curriculum_and_attached_file_are_versi_1b38fd": ". Only the title, course code, curriculum and attached file are versioned; the other fields in this editor are not stored on the server.",
	"ui.auto_save_enabled_e07e38": " Auto-save enabled",
	"ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_ru_c5ec32": "Saved with this version in the history, e.g. Updated the grading rubric",
	"ui.previous_471492": "← Previous",
	"ui.save_next_fe34ca": "Save & Next →",
	"ui.finish_editing_9f0a56": "Finish Editing",
	"ui.user_created_their_username_and_a_temporary_password_were_sent_to_c6e730": "User created. Their username and a temporary password were sent to ",
	"ui.user_created_but_no_email_was_sent_161a02": "User created, but no email was sent. ",
	"ui.use_resend_credentials_once_it_works_7a3632": " Use \"Resend credentials\" once it works.",
	"ui.new_credentials_sent_to_cca8dd": "New credentials sent to ",
	"ui.nothing_was_changed_the_email_could_not_be_sent_3b7ba4": "Nothing was changed: the email could not be sent. ",
	"ui.user_removed_f2fdb9": "User removed.",
	"ui.users_roles_972dae": "Users & Roles",
	"ui.only_users_listed_here_can_sign_in_remove_a_user_to_revoke_their__f115b1": "Only users listed here can sign in. Remove a user to revoke their access.",
	"ui.pre_register_user_2fa046": "+ Pre-register User",
	"ui.first_name_b6ea99": "First Name",
	"ui.juan_c5652d": "Juan",
	"ui.last_name_863cb3": "Last Name",
	"ui.santos_cdb56f": "Santos",
	"ui.institutional_email_29be78": "Institutional Email",
	"ui.name_email_lcup_edu_ph_2475c2": "name@email.lcup.edu.ph",
	"ui.an_institutional_address_ending_in_email_lcup_edu_ph_6749cb": "An institutional address ending in @email.lcup.edu.ph",
	"ui.role_c3f104": "Role",
	"ui.save_efc007": "Save",
	"ui.a_temporary_password_is_generated_and_emailed_to_the_user_with_th_9bb144": "A temporary password is generated and emailed to the user with their username (their email address, which must end in @email.lcup.edu.ph). They choose their own password the first time they sign in.",
	"ui.user_9f8a23": "User",
	"ui.email_84add5": "Email",
	"ui.permissions_d06d55": "Permissions",
	"ui.resend_credentials_1ba6fd": "Resend credentials",
	"ui.remove_e96390": "Remove",
	"ui.no_users_found_e611ef": "No users found."
};
const tl$1 = {
	"dashboard.welcomeBack": "Maligayang pagbabalik, {name}!",
	"ui.syllabus_saved_as_p0_60fc5d": "Na-save ang silabus bilang {p0}.",
	"ui.syllabus_submitted_for_review_f317be": "Naipasa ang silabus para sa pagsusuri.",
	"ui.submit_failed_adb15a": "Hindi naipasa: ",
	"ui.syllabus_p0_bf213e": "Silabus: {p0}.",
	"ui.update_failed_f7b7c9": "Hindi na-update: ",
	"ui.only_draft_syllabi_can_be_deleted_by_faculty_832244": "Mga draft na silabus lamang ang maaaring burahin ng guro.",
	"ui.syllabus_deleted_638a8c": "Nabura ang silabus.",
	"ui.delete_failed_c834e9": "Hindi nabura: ",
	"ui.your_activity_list_was_cleared_642fa2": "Na-clear ang iyong listahan ng aktibidad.",
	"ui.logging_out_3df779": "Nagsa-sign out…",
	"ui.loading_b04ba4": "Naglo-load...",
	"ui.the_two_passwords_do_not_match_d9ae81": "Hindi magkapareho ang dalawang password.",
	"ui.the_password_could_not_be_changed_ceb60b": "Hindi mapalitan ang password.",
	"ui.college_logo_1df91f": "Logo ng kolehiyo",
	"ui.first_sign_in_e8fad6": "Unang pag-sign in",
	"ui.choose_your_own_password_19d96e": "Pumili ng sarili mong password",
	"ui.you_are_signed_in_as_531cce": "Naka-sign in ka bilang ",
	"ui.with_a_temporary_password_choose_a_new_one_to_continue_c9567a": " gamit ang pansamantalang password. Pumili ng bago upang magpatuloy.",
	"ui.new_password_159d33": "Bagong password ",
	"ui.hide_passwords_37701c": "Itago ang mga password",
	"ui.show_passwords_a76567": "Ipakita ang mga password",
	"ui.type_it_again_da6510": "I-type muli ",
	"ui.saving_56a228": "Nagse-save…",
	"ui.save_and_continue_3b033f": "I-save at magpatuloy",
	"ui.sign_out_dc1649": "Mag-sign out",
	"ui.messages_f1702b": "Mga mensahe",
	"ui.unknown_bc7819": "Hindi kilala",
	"ui.delete_conversation_de4346": "Burahin ang pag-uusap",
	"ui.delete_all_messages_this_cannot_be_undone_39516a": "Burahin ang lahat ng mensahe? Hindi na ito maibabalik.",
	"ui.cancel_77dfd2": "Kanselahin",
	"ui.delete_f6fdbe": "Burahin",
	"ui.no_messages_yet_start_a_conversation_d5ea96": "Wala pang mensahe. Magsimula ng pag-uusap.",
	"ui.read_927abf": "✓ Nabasa",
	"ui.sent_610540": "✓ Naipadala",
	"ui.type_a_message_09bdff": "Mag-type ng mensahe...",
	"ui.send_9bc257": "Ipadala",
	"ui.check_history_087c5b": "Kasaysayan ng pagsusuri",
	"ui.each_checked_subject_appears_once_newest_first_open_one_to_see_it_468518": "Isang beses nakalista ang bawat nasuring asignatura, mula sa pinakabago. Buksan ito upang makita ang mga marka.",
	"ui.filter_the_history_by_date_771c36": "Salain ang kasaysayan ayon sa petsa",
	"ui.from_3f6605": "Mula",
	"ui.to_ae79ea": "Hanggang",
	"ui.apply_cfea41": "Ilapat",
	"ui.reset_44c57a": "I-reset",
	"ui.the_from_date_is_after_the_to_date_2c84ad": "Mas huli ang petsang Mula kaysa sa petsang Hanggang.",
	"ui.loading_the_history_8f2942": "Nilo-load ang kasaysayan…",
	"ui.no_check_was_stored_in_this_date_range_548438": "Walang naitalang pagsusuri sa saklaw na ito ng petsa. ",
	"ui.no_syllabus_has_been_checked_yet_ec0425": "Wala pang nasuring silabus.",
	"ui.checked_d42130": ", sinuri noong ",
	"ui.unknown_faculty_753147": "Hindi kilalang guro",
	"ui.by_administrator_c55e2e": "Ng administrador",
	"ui.on_submit_952d52": "Sa pagpasa",
	"ui.checked_b2bc0c": "Nasuri",
	"ui.show_more_ada6d7": "Magpakita pa (",
	"ui.more_5ca940": " pa)",
	"ui.checked_aca936": "Nasuri ",
	"ui.this_is_an_earlier_check_newer_results_are_in_the_history_32d14b": "Mas naunang pagsusuri ito. Nasa kasaysayan ang mas bagong resulta.",
	"ui.this_syllabus_is_approved_so_this_check_is_final_6d57e9": "Aprubado na ang silabus na ito kaya pinal na ang pagsusuring ito.",
	"ui.compliance_score_7a084d": "Marka sa pagsunod ",
	"ui.percent_c72154": " porsiyento, ",
	"ui.no_score_yet_3662ab": "Wala pang marka",
	"ui.not_enough_content_1c0e67": "Kulang ang nilalaman",
	"ui.not_checked_22705e": "Hindi pa nasuri",
	"ui.close_bbfa77": "Isara",
	"ui.enter_the_email_address_you_registered_with_8e2dd3": "Ilagay ang email address na ginamit mo sa pagpaparehistro.",
	"ui.the_request_could_not_be_sent_11fa24": "Hindi maipadala ang kahilingan.",
	"ui.forgot_password_5ed117": "Nakalimutang password",
	"ui.get_a_temporary_password_c137bb": "Kumuha ng pansamantalang password",
	"ui.if_ed46f9": "Kung ",
	"ui.is_registered_a_temporary_password_has_been_sent_to_it_it_works_f_64f2a8": " ay nakarehistro, pinadalhan ito ng pansamantalang password. Magagamit ito sa loob ng 30 minuto, at hihilinging pumili ka ng bagong password kapag ginamit mo ito.",
	"ui.your_current_password_still_works_until_you_do_e6c36b": "Magagamit pa rin ang kasalukuyan mong password hanggang mapalitan mo ito.",
	"ui.back_to_sign_in_4da821": "Bumalik sa pag-sign in",
	"ui.type_the_email_address_you_were_registered_with_we_will_email_you_b27a78": "I-type ang email address na ginamit sa pagpaparehistro. Padadalhan ka namin ng pansamantalang password.",
	"ui.type_your_registered_email_address_4e92a6": "I-type ang email address na ginamit mo sa pagpaparehistro.",
	"ui.email_2f707b": "Email ",
	"ui.name_university_edu_ph_4d6969": "name@university.edu.ph",
	"ui.sending_cf7655": "Ipinapadala…",
	"ui.send_temporary_password_02ad7e": "Ipadala ang pansamantalang password",
	"ui.enter_your_username_email_and_password_7bf61f": "Ilagay ang iyong username o email at password.",
	"ui.academic_quality_93a706": "KALIDAD NG EDUKASYON",
	"ui.syllabus_1b731d": "Silabus",
	"ui.management_system_738978": "Sistema ng Pamamahala",
	"ui.build_validate_review_approve_archive_and_analyze_undergraduate_s_0aef77": "Bumuo, suriin, aprubahan, i-archive, at pag-aralan ang mga silabus ng undergraduate sa iisang sistema ng institusyon.",
	"ui.ai_compliance_602783": " Pagsunod gamit ang AI",
	"ui.approval_workflow_cc8935": " Proseso ng pag-apruba",
	"ui.welcome_back_593f1e": "MALIGAYANG PAGBALIK",
	"ui.sign_in_to_sms_52fec0": "Mag-sign in sa SMS",
	"ui.sign_in_to_login_7c41d8": "Mag-sign in sa Login",
	"ui.use_your_institutional_account_to_continue_143ca3": "Gamitin ang iyong account sa institusyon upang magpatuloy.",
	"ui.username_or_email_728ae0": "Username o Email",
	"ui.password_8be3c9": "Password",
	"ui.hide_password_e40123": "Itago ang password",
	"ui.show_password_044b85": "Ipakita ang password",
	"ui.remember_me_3444b2": " Tandaan ako",
	"ui.forgot_password_4c29f7": "Nakalimutan ang password?",
	"ui.sign_in_f8492c": "Mag-sign in",
	"ui.or_175835": "o",
	"ui.register_for_students_2f6e9d": "Magparehistro (para sa mga estudyante)",
	"ui.main_navigation_efd197": "Pangunahing nabigasyon",
	"ui.expand_sidebar_f462e8": "Palawakin ang sidebar",
	"ui.collapse_sidebar_9e6876": "Paliitin ang sidebar",
	"ui.cict_logo_dee290": "Logo ng CICT",
	"ui.sms_9e10d4": "SMS",
	"ui.cite_brand_5b2e91": "CITE",
	"ui.is_this_your_cor_1d57c8": "Ito ba ang iyong COR?",
	"ui.this_is_what_we_read_from_your_photo_it_can_t_be_edited_here_c24d4b": "Ito ang nabasa namin mula sa iyong larawan. Hindi ito maaaring baguhin dito.",
	"ui.not_readable_c35717": "Hindi mabasa",
	"ui.enrolled_subjects_0ea329": "Mga naka-enroll na asignatura",
	"ui.we_could_not_read_the_subject_list_from_your_photo_this_will_not__c5b836": "Hindi namin mabasa ang listahan ng asignatura mula sa iyong larawan. Maaari ka pa ring magparehistro.",
	"ui.your_enrollment_in_bsit_looks_confirmed_your_account_will_be_read_fa67fa": "Nakumpirma ang iyong pag-enroll sa BSIT. Magagamit agad ang iyong account.",
	"ui.we_could_not_confirm_everything_on_your_cor_you_can_still_registe_0afe9d": "Hindi namin makumpirma ang lahat ng nasa iyong COR. Maaari ka pa ring magparehistro: susuriin muna ng administrador ang iyong COR bago ka makapag-sign in. Maaaring maiwasan ang paghihintay sa pamamagitan ng mas malinaw na larawan ng buong pahina, patag at may sapat na liwanag.",
	"ui.retake_photo_4873d4": "Kunan muli",
	"ui.creating_account_27b8a2": "Ginagawa ang account...",
	"ui.confirm_and_register_558ffe": "Kumpirmahin at magparehistro",
	"ui.upload_a_photo_of_your_cor_jpg_png_or_webp_b5323e": "Mag-upload ng larawan ng iyong COR (JPG, PNG o WebP).",
	"ui.that_photo_is_larger_than_10mb_801f53": "Lampas sa 10 MB ang larawang iyon.",
	"ui.use_a_password_of_at_least_8_characters_69cc28": "Gumamit ng password na may hindi bababa sa 8 character.",
	"ui.the_passwords_do_not_match_540a66": "Hindi magkapareho ang mga password.",
	"ui.upload_your_cor_to_continue_da868b": "I-upload ang iyong COR upang magpatuloy.",
	"ui.registration_complete_ab7971": "Tapos na ang pagpaparehistro",
	"ui.waiting_for_verification_a113ec": "Naghihintay ng beripikasyon",
	"ui.back_to_sign_in_c65048": "Bumalik sa pag-sign in",
	"ui.student_registration_ef00b6": "PAGPAPAREHISTRO NG ESTUDYANTE",
	"ui.create_your_account_4046b5": "Gawin ang iyong account",
	"ui.for_bsit_students_we_read_your_cor_to_verify_your_enrollment_and__bed562": "Para sa mga estudyante ng BSIT. Babasahin namin ang iyong COR upang beripikahin ang pag-enroll mo, at ang iyong student ID ang magiging username mo.",
	"ui.certificate_of_registration_cor_0ef71c": "Certificate of Registration (COR) ",
	"ui.click_or_drop_to_replace_7c5654": "I-click o ihulog upang palitan",
	"ui.take_a_photo_or_upload_your_cor_cea856": "Kunan o i-upload ang iyong COR",
	"ui.whole_page_flat_in_good_light_image_only_max_10mb_73f731": "Buong pahina, patag, may sapat na liwanag • Larawan lamang • Hanggang 10 MB",
	"ui.password_0aa0ce": "Password ",
	"ui.at_least_8_characters_1fe494": "Hindi bababa sa 8 character",
	"ui.confirm_password_228465": "Kumpirmahin ang password ",
	"ui.type_it_again_488399": "I-type muli",
	"ui.reading_your_cor_this_can_take_a_few_seconds_595ad5": "Binabasa ang iyong COR... maaaring tumagal nang ilang segundo",
	"ui.scan_cor_and_continue_696299": "I-scan ang COR at magpatuloy",
	"ui.back_to_sign_in_e52282": "← Bumalik sa pag-sign in",
	"ui.reviewer_comments_7d59b1": "Mga komento ng tagasuri",
	"ui.notes_from_your_reviewer_about_this_syllabus_including_the_reason_d994eb": "Mga tala ng tagasuri tungkol sa silabus na ito, kasama ang dahilan ng pasya. Magpadala ng mensahe upang talakayin ito.",
	"ui.reply_by_message_0df524": "✉ Tumugon sa mensahe",
	"ui.choose_a_syllabus_to_check_b6f6d2": "Pumili ng silabus na susuriin",
	"ui.choose_a_syllabus_cd5a79": "Pumili ng silabus",
	"ui.syllabi_waiting_for_their_first_check_once_checked_a_syllabus_mov_d3e75a": "Mga silabus na naghihintay ng unang pagsusuri. Pagkasuri, lilipat ang silabus sa kasaysayan sa ibaba.",
	"ui.faculty_9ae050": "Guro",
	"ui.loading_33ce41": "Naglo-load…",
	"ui.nothing_is_waiting_for_a_check_28b41a": "Walang naghihintay ng pagsusuri",
	"ui.choose_a_faculty_member_65ac86": "Pumili ng guro",
	"ui.program_9d6800": "Programa",
	"ui.choose_a_program_2d5477": "Pumili ng programa",
	"ui.no_program_d8600a": "Walang programa",
	"ui.subject_8d183d": "Asignatura",
	"ui.choose_a_subject_554b9c": "Pumili ng asignatura",
	"ui.checking_820d60": "Sinusuri…",
	"ui.not_checked_yet_82bd72": "Hindi pa nasusuri",
	"ui.this_syllabus_was_uploaded_as_a_file_so_only_the_file_and_its_cou_b947f8": "Na-upload bilang file ang silabus na ito, kaya ang file at detalye ng kurso lamang ang sinusuri. Kailangan ang serbisyong AI upang ihambing ito sa template, ngunit hindi pa ito naka-enable.",
	"ui.there_is_nothing_in_this_syllabus_that_can_be_checked_32e258": "Walang nilalaman sa silabus na ito na maaaring suriin.",
	"ui.loading_syllabi_264639": "Nilo-load ang mga silabus…",
	"ui.every_submitted_syllabus_has_been_checked_see_the_history_below_4c13bf": "Nasuri na ang lahat ng naipasang silabus. Tingnan ang kasaysayan sa ibaba.",
	"ui.nothing_chosen_yet_a7c4c2": "Wala pang napili.",
	"ui.check_compliance_342b8f": "Suriin ang pagsunod",
	"ui.could_not_open_this_syllabus_d06b9d": "Hindi mabuksan ang silabus na ito.",
	"ui.opening_b1b853": "Binubuksan…",
	"ui.version_2da600": "Bersiyon",
	"ui.version_03283e": "Bersiyon ",
	"ui.saved_form_not_submitted_yet_c3a777": "Naka-save na form, hindi pa naipapasa",
	"ui.changed_since_737991": "Nabago mula sa ",
	"ui.nothing_the_faculty_member_wrote_differs_from_a512f5": "Walang isinulat ang guro na naiiba sa ",
	"ui.opening_the_syllabus_51c75a": "Binubuksan ang silabus…",
	"ui.open_79d37e": "Buksan ",
	"ui.uploaded_syllabus_73f85b": "Na-upload na silabus",
	"ui.review_e29a79": "Suriin",
	"ui.profile_photo_updated_3d7ef0": "Na-update ang larawan sa profile.",
	"ui.could_not_update_your_photo_78f1fc": "Hindi ma-update ang iyong larawan.",
	"ui.profile_photo_removed_1e6a07": "Naalis ang larawan sa profile.",
	"ui.could_not_remove_your_photo_ed1d1f": "Hindi maalis ang iyong larawan.",
	"ui.syllabus_management_system_e49cab": "SISTEMA NG PAMAMAHALA NG SILABUS",
	"ui.search_syllabus_course_faculty_67a24a": "Maghanap ng silabus, kurso, guro...",
	"ui.messages_p0_unread_f09423": "Mga mensahe, {p0} hindi pa nababasa",
	"ui.unread_2630a7": " hindi pa nababasa",
	"ui.no_conversations_yet_265928": "Wala pang pag-uusap.",
	"ui.notifications_753a22": "Mga abiso",
	"ui.notifications_p0_unread_5c2cb7": "Mga abiso, {p0} hindi pa nababasa",
	"ui.mark_all_read_8958e2": "Markahang nabasa lahat",
	"ui.all_caught_up_47cbaf": "Nabasa na ang lahat",
	"ui.no_notifications_yet_5537c6": "Wala pang abiso.",
	"ui.unknown_role_476868": "Hindi kilalang tungkulin",
	"ui.profile_photo_33f385": "Larawan sa profile",
	"ui.change_photo_ed5690": "Palitan ang larawan",
	"ui.remove_photo_c8f5ed": "Alisin ang larawan",
	"ui.log_out_6e78c9": "Mag-sign out",
	"ui.mapped_outcomes_f695cc": "Mga kaugnay na kinalabasan: ",
	"ui.could_not_load_the_history_8efe8d": "Hindi ma-load ang kasaysayan.",
	"ui.version_history_91f865": "Kasaysayan ng mga bersiyon",
	"ui.version_history_6974ab": "Kasaysayan ng mga Bersiyon",
	"ui.loading_history_02cb12": "Nilo-load ang kasaysayan…",
	"ui.no_versions_recorded_yet_a3a752": "Wala pang naitalang bersiyon.",
	"ui.every_version_that_was_submitted_is_kept_and_none_is_ever_changed_24fa9a": "Pinananatili ang bawat naipasang bersiyon at hindi na binabago. Buksan ang isa upang basahin ang orihinal nitong anyo.",
	"ui.current_4fc0e2": "Kasalukuyan",
	"ui.changed_since_the_version_before_01d3f5": "Nabago mula sa naunang bersiyon: ",
	"ui.changed_8d443e": "Nabago: ",
	"ui.by_876074": " ni ",
	"ui.on_bac8e7": " noong ",
	"ui.download_file_774025": "I-download ang file",
	"ui.view_version_1109c5": "Tingnan ang bersiyon ",
	"ui.the_compliance_check_is_in_step_7_of_the_syllabus_builder_1f3135": "Nasa hakbang 7 ng Tagabuo ng Silabus ang pagsusuri sa pagsunod.",
	"ui.ai_syllabus_checker_0c99c9": "Tagasuri ng Silabus gamit ang AI",
	"ui.check_each_submitted_syllabus_against_the_template_the_result_is__703bf5": "Suriin ang bawat naipasang silabus ayon sa template. Itinatala ang resulta kasama ng bersiyong nakikita ng tagasuri. Kasalukuyang paraan: ",
	"ui.compliance_checks_are_not_set_up_on_this_server_yet_ask_an_admini_815abc": "Hindi pa naka-set up ang pagsusuri sa pagsunod sa server na ito. Hilingin sa administrador na patakbuhin ang update sa database; walang maitatala hangga't hindi ito nagagawa.",
	"ui.the_check_supports_but_does_not_replace_faculty_curriculum_commit_e24080": "Gabay ang pagsusuri para sa guro, komite sa kurikulum, at pagsusuri sa kalidad ng edukasyon; hindi nito pinapalitan ang mga ito.",
	"ui.mar_c4ba08": "Mar",
	"ui.apr_befde5": "Abr",
	"ui.may_c94f47": "May",
	"ui.jun_6d90df": "Hun",
	"ui.jul_b73755": "Hul",
	"ui.aug_75629a": "Ago",
	"ui.high_80_100_234a35": "Mataas (80–100%)",
	"ui.medium_50_79_d47c66": "Katamtaman (50–79%)",
	"ui.low_50_979304": "Mababa (<50%)",
	"ui.10_years_cf5ed9": "≤ 10 taon",
	"ui.0_5_years_56523b": "0–5 taon",
	"ui.6_10_years_4da687": "6–10 taon",
	"ui.10_years_86387f": ">10 taon",
	"ui.my_analytics_1ab328": "Aking Estadistika",
	"ui.analytics_quality_dashboard_b85172": "Estadistika at Kalidad",
	"ui.track_your_personal_compliance_scores_and_submission_performance_b66964": "Subaybayan ang iyong marka sa pagsunod at pagganap sa pagpasa.",
	"ui.monitor_compliance_curriculum_coverage_submission_performance_and_78b463": "Subaybayan ang pagsunod, saklaw ng kurikulum, pagganap sa pagpasa, at pagbabago sa kalidad ng silabus.",
	"ui.ay_2026_2027_830f3e": "Taong Panuruan 2026–2027",
	"ui.ay_2025_2026_8b00a8": "Taong Panuruan 2025–2026",
	"ui.download_report_9f36e2": "⇩ I-download ang ulat",
	"ui.compliance_trend_2fa4a1": "Takbo ng pagsunod",
	"ui.your_ai_compliance_score_over_time_f2f70b": "Marka ng iyong silabus sa paglipas ng panahon",
	"ui.average_ai_compliance_score_603cf2": "Karaniwang marka sa pagsusuri ng AI",
	"ui.outcome_coverage_5788ff": "Saklaw ng mga kinalabasan",
	"ui.your_syllabus_coverage_b60846": "Saklaw ng iyong silabus",
	"ui.coverage_across_approved_syllabi_923a95": "Saklaw sa mga aprubadong silabus",
	"ui.submission_completion_b3968d": "Pagkumpleto ng pagpasa",
	"ui.your_submissions_e58b57": "Mga naipasa mo",
	"ui.by_program_11a420": "Ayon sa programa",
	"ui.reference_currency_7c7576": "Pagiging napapanahon ng sanggunian",
	"ui.age_of_cited_learning_resources_2711b5": "Edad ng mga sangguniang ginamit",
	"ui.quality_dimensions_41c80b": "Mga aspeto ng kalidad",
	"ui.your_quality_scores_8f5d5e": "Mga marka ng iyong kalidad",
	"ui.average_percentage_scores_by_program_3c980a": "Karaniwang porsiyento ng marka ayon sa programa",
	"ui.actionable_insights_9816fd": "Mga mungkahing hakbang",
	"ui.tips_for_your_submissions_76ea2a": "Mga mungkahi para sa iyong mga naipasa",
	"ui.ai_generated_quality_observations_82b3fd": "Mga obserbasyon ng AI tungkol sa kalidad",
	"ui.assignments_saved_for_p0_p1_c93ea6": "Na-save ang mga pagtatalaga para kina {p0} {p1}.",
	"ui.failed_9500be": "Hindi nagtagumpay: ",
	"ui.assignments_057d58": "Mga pagtatalaga",
	"ui.could_not_load_the_assignments_7525d7": "Hindi ma-load ang mga pagtatalaga: ",
	"ui.programs_ab14d0": "Mga programa",
	"ui.programs_bbc93f": "Mga programa ",
	"ui.of_607f2d": " sa ",
	"ui.assigned_cb6e65": " naitalaga",
	"ui.assign_f1e181": "Italaga ang ",
	"ui.to_3a59c4": " sa ",
	"ui.no_programs_exist_yet_f41802": "Wala pang programa.",
	"ui.tick_a_program_to_assign_it_the_count_is_subjects_assigned_out_of_6c6499": "Lagyan ng tsek ang programa upang italaga ito. Ipinapakita ng bilang ang mga naitalagang asignatura kumpara sa lahat ng nasa katalogo.",
	"ui.subjects_of_08ca3f": "Mga asignatura ng ",
	"ui.subjects_278947": "Mga asignatura",
	"ui.choose_a_program_to_see_its_subjects_bf5ee2": "Pumili ng programa upang makita ang mga asignatura nito.",
	"ui.select_all_913aff": "Piliin lahat",
	"ui.clear_719ea3": "I-clear",
	"ui.is_not_assigned_to_914cca": " ay hindi pa naitatalaga kay ",
	"ui.yet_tick_it_on_the_left_to_assign_its_subjects_you_can_still_add__b0b1ca": " . Lagyan ito ng tsek sa kaliwa upang maitalaga ang mga asignatura nito. Maaari ka pa ring magdagdag ng asignatura sa Programa at mga Asignatura.",
	"ui.search_736a49": "Hanapin ang ",
	"ui.subjects_4ad212": " mga asignatura",
	"ui.search_subjects_45c4dd": "Maghanap ng asignatura",
	"ui.assigned_e24e82": "Naitalaga",
	"ui.code_adac69": "Code",
	"ui.title_768e0c": "Pamagat",
	"ui.no_subject_matches_your_search_d6a180": "Walang asignaturang tumutugma sa iyong paghahanap.",
	"ui.no_subjects_in_662f89": "Wala pang asignatura sa ",
	"ui.yet_add_them_in_subjects_amp_clos_then_assign_them_here_5ddd30": " . Idagdag ang mga ito sa mga Asignatura at CLO, pagkatapos ay italaga rito.",
	"ui.go_to_subjects_amp_clos_c825d0": "Pumunta sa mga Asignatura at CLO",
	"ui.program_c2e68c": " programa",
	"ui.subject_5983be": " asignatura",
	"ui.save_assignments_710200": "I-save ang mga pagtatalaga",
	"ui.used_by_f5060a": "Ginagamit ng",
	"ui.clo_069efc": "CLO ",
	"ui.vision_and_mission_4c8752": "Bisyon at misyon",
	"ui.vision_40b090": "Bisyon",
	"ui.mission_e4698d": "Misyon",
	"ui.expected_graduate_attributes_86f980": "Mga inaasahang katangian ng nagtapos",
	"ui.program_outcomes_b86d07": "Mga kinalabasan ng programa · ",
	"ui.ega_4f085b": "EGA ",
	"ui.po_3756d6": "PO ",
	"ui.ega_7bee0f": "[EGA ",
	"ui.no_program_outcomes_are_loaded_for_db8e64": "Walang naka-load na kinalabasan ng programa para sa ",
	"ui.an_administrator_adds_them_in_institution_settings_ddb051": ". Idinaragdag ang mga ito ng administrador sa mga setting ng institusyon.",
	"ui.choose_a_program_in_step_1_to_load_its_program_outcomes_d121f2": "Pumili ng programa sa hakbang 1 upang ma-load ang mga kinalabasan nito.",
	"ui.the_badges_show_which_of_the_course_learning_outcomes_use_each_at_6463d4": "Ipinapakita ng mga badge kung aling CLO ang gumagamit sa bawat katangian o kinalabasan. Itapat ang pointer sa CLO sa ibaba upang makita ang mga kaugnay nito.",
	"ui.course_learning_outcomes_503861": "Mga kinalabasan ng pagkatuto sa kurso",
	"ui.choose_a_subject_in_step_1_to_load_its_learning_outcomes_017d6f": "Pumili ng asignatura sa hakbang 1 upang ma-load ang mga kinalabasan ng pagkatuto nito.",
	"ui.no_learning_outcomes_are_defined_for_abd5b1": "Walang nakatalagang kinalabasan ng pagkatuto para sa ",
	"ui.yet_an_administrator_adds_them_in_subjects_amp_clos_2e8b78": " . Idinaragdag ang mga ito ng administrador sa mga Asignatura at CLO.",
	"ui.none_6eef66": "Wala",
	"ui.program_outcomes_858de9": "Mga kinalabasan ng programa",
	"ui.clo_numbers_follow_the_order_in_the_subject_catalog_in_step_3_you_bbf7d3": "Nakabatay sa pagkakasunod sa katalogo ang mga bilang ng CLO. Sa hakbang 3, itinatala mo ang mga CLO, EGA, at kinalabasan ng programa na sinusuportahan ng bawat ILO.",
	"ui.compliance_check_cf2d1e": "Pagsusuri sa pagsunod",
	"ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a": "Sinusuri ayon sa form ng Undergraduate Syllabus. Ang hindi pagsunod sa template lamang ang pumipigil sa pagpasa; gabay para sa iyo at sa tagasuri ang marka at iba pang resulta.",
	"ui.re_check_9cf055": "Suriin muli",
	"ui.compliance_checks_are_not_available_on_this_server_yet_you_can_st_d6b109": "Hindi pa magagamit ang pagsusuri sa pagsunod sa server na ito. Maaari ka pa ring magpasa.",
	"ui.checking_your_syllabus_1278c5": "Sinusuri ang iyong silabus…",
	"ui.not_checked_yet_8ea64e": "Hindi pa nasusuri.",
	"ui.component_c92c52": "Bahagi",
	"ui.abbr_b9bce8": "daglat",
	"ui.abbreviation_cd4378": "Daglat",
	"ui.percent_dff0eb": " porsiyento",
	"ui.remove_component_200c43": "Alisin ang bahagi",
	"ui.add_component_2364b5": "+ Magdagdag ng bahagi",
	"ui.weights_cd9b0c": "Mga timbang: ",
	"ui.total_b25928": "Kabuuan",
	"ui.should_be_100_655251": "dapat ay 100%",
	"ui.final_rating_lists_29eda9": "Nakalista sa pinal na marka ang ",
	"ui.of_3_terms_add_the_missing_exam_rows_in_step_3_694862": " sa 3 termino. Idagdag ang mga kulang na hanay ng pagsusulit sa hakbang 3.",
	"ui.final_rating_is_built_from_your_496f08": "Nakabatay ang pinal na marka sa iyong ",
	"ui.exam_rows_db6139": " mga hanay ng pagsusulit.",
	"ui.write_the_formulas_myself_8320f5": "Ako ang magsusulat ng mga formula ",
	"ui.term_grade_2e36c7": "Marka sa termino",
	"ui.final_rating_26f0fa": "Pinal na marka",
	"ui.loading_the_syllabus_builder_e89b32": "Nilo-load ang tagabuo ng silabus...",
	"ui.could_not_open_the_builder_7169ab": "Hindi mabuksan ang tagabuo: ",
	"ui.could_not_load_that_subject_8e9791": "Hindi ma-load ang asignaturang iyon: ",
	"ui.could_not_save_your_changes_check_your_connection_and_try_again_17b0b0": "Hindi ma-save ang iyong mga pagbabago. Suriin ang koneksiyon at subukan muli.",
	"ui.choose_a_subject_first_24357e": "Pumili muna ng asignatura.",
	"ui.upload_failed_31c949": "Hindi na-upload: ",
	"ui.syllabus_builder_editor_ac6179": "Tagabuo / Editor ng Silabus",
	"ui.fill_in_the_institutional_syllabus_form_step_by_step_every_part_i_35903f": "Punan ang form ng silabus ng institusyon nang paisa-isang hakbang. Magkakaugnay ang bawat bahagi.",
	"ui.save_now_3989b7": "I-save ngayon",
	"ui.how_to_submit_0e4bbb": "Paano magpasa",
	"ui.fill_in_the_form_e4aa1f": "Punan ang form",
	"ui.upload_a_file_instead_eaad9b": "Mag-upload na lang ng file",
	"ui.course_code_9c9dad": "Code ng kurso",
	"ui.course_title_265cd6": "Pamagat ng kurso",
	"ui.school_year_ec856b": "Taong panuruan",
	"ui.status_bae7d5": "Kalagayan",
	"ui.steps_cdde4f": "Mga hakbang",
	"ui.finish_step_316523": "Tapusin muna ang hakbang ",
	"ui.first_faeaef": " nang mauna",
	"ui.locked_adec79": "naka-lock",
	"ui.complete_0737c2": "kumpleto",
	"ui.needs_attention_3ad98d": "kailangang ayusin",
	"ui.complete_f37486": " kumpleto",
	"ui.you_can_read_this_syllabus_but_not_change_it_until_an_administrat_4f4ecd": " Mababasa mo ang silabus na ito, ngunit hindi mo ito mababago hangga't hindi muling itinatalaga sa iyo ng administrador ang kurso.",
	"ui.returned_for_revision_d2426a": "Ibinalik para baguhin.",
	"ui.your_next_submission_becomes_d37d36": " Ang susunod mong ipapasa ay magiging ",
	"ui.once_you_change_something_b3eaf9": " kapag may binago ka; ",
	"ui.and_every_earlier_version_stay_in_the_history_f8dfa6": " at ang lahat ng naunang bersiyon ay mananatili sa kasaysayan.",
	"ui.reviewer_s_note_573dfd": "Tala ng tagasuri: ",
	"ui.step_c5964d": "HAKBANG ",
	"ui.of_f69649": " SA ",
	"ui.retry_9f5cd8": "Subukan muli",
	"ui.finish_the_steps_marked_in_the_list_review_check_the_compliance_c_31bb82": "Tapusin ang mga hakbang na may ! sa listahan. Suriin at Tiyakin: ang pagsusuri sa pagsunod at ",
	"ui.saving_a_new_version_a8d794": "pag-save ng bagong bersiyon",
	"ui.submitting_8ee0db": "pagpasa",
	"ui.unlock_once_steps_1_to_6_are_complete_f983eb": " ay magbubukas kapag kumpleto na ang hakbang 1 hanggang 6.",
	"ui.to_continue_3819bf": "Upang magpatuloy:",
	"ui.this_step_cannot_be_completed_yet_d2c256": "Hindi pa maaaring tapusin ang hakbang na ito.",
	"ui.check_again_e18504": "Suriin muli",
	"ui.in_the_compliance_check_they_do_not_block_you_the_reviewer_will_s_d35203": " sa pagsusuri sa pagsunod. Hindi ka nito pipigilan: makikita ito ng tagasuri, kaya ayusin muna ang kaya mo.",
	"ui.suggestions_73fedd": "Mga mungkahi: ",
	"ui.complete_this_step_to_continue_71b565": "Tapusin ang hakbang na ito upang magpatuloy",
	"ui.next_94377f": "Susunod: ",
	"ui.run_the_compliance_check_again_49661e": "Patakbuhin muli ang pagsusuri sa pagsunod",
	"ui.complete_steps_1_to_6_to_unlock_b21a68": "Tapusin ang hakbang 1 hanggang 6 upang mabuksan",
	"ui.say_what_you_changed_a_sentence_first_01ece1": "Sabihin muna sa isang pangungusap kung ano ang binago mo",
	"ui.program_2f03bb": "Programa *",
	"ui.choosing_a_program_loads_its_program_outcomes_into_step_2_9e3350": "Kapag pumili ka ng programa, malo-load ang mga kinalabasan nito sa hakbang 2.",
	"ui.loads_7a0d36": "Nilo-load ang ",
	"ui.program_outcomes_9989b2": " mga kinalabasan ng programa",
	"ui.into_step_2_cd03a4": " sa hakbang 2.",
	"ui.no_program_outcomes_loaded_for_23e032": "Wala pang naka-load na kinalabasan ng programa para sa ",
	"ui.yet_an_administrator_adds_them_a9bb24": " . Idinaragdag ang mga ito ng administrador.",
	"ui.subject_i_ii_0cd15b": "Asignatura * (I, II)",
	"ui.choose_a_program_first_43fce3": "Pumili muna ng programa",
	"ui.no_subjects_yet_1e06ee": "Wala pang asignatura",
	"ui.subjects_are_listed_by_program_41c330": "Nakalista ang mga asignatura ayon sa programa.",
	"ui.the_subject_sets_the_code_title_and_learning_outcomes_632d3c": "Itinatakda ng asignatura ang code, pamagat, at mga kinalabasan ng pagkatuto.",
	"ui.no_subjects_have_been_added_for_679751": "Wala pang naidagdag na asignatura para sa ",
	"ui.its_code_title_and_learning_outcomes_load_from_the_subject_cecbb5": "Nilo-load mula sa asignatura ang code, pamagat, at mga kinalabasan ng pagkatuto nito.",
	"ui.credit_units_v_40ba2a": "Mga yunit * (V)",
	"ui.lecture_units_de9aaf": "Mga yunit sa lektura",
	"ui.units_lecture_2a1d2c": "yunit sa lektura /",
	"ui.laboratory_units_067e02": "Mga yunit sa laboratoryo",
	"ui.unit_laboratory_60e5a6": "yunit sa laboratoryo",
	"ui.pre_requisite_iv_1c46d5": "Paunang kailangan (IV)",
	"ui.pre_requisite_d4ec8c": "Paunang kailangan",
	"ui.course_description_iii_db7708": "Paglalarawan ng kurso * (III)",
	"ui.describe_the_course_in_a_few_sentences_8c883c": "Ilarawan ang kurso sa ilang pangungusap",
	"ui.description_paragraph_207be8": "Talata ng paglalarawan ",
	"ui.remove_paragraph_4bf624": "Alisin ang talata",
	"ui.add_paragraph_8df913": "+ Magdagdag ng talata",
	"ui.course_code_c3a63c": "Code ng kurso ",
	"ui.course_title_b609b8": "Pamagat ng kurso ",
	"ui.school_year_fa59aa": "Taong panuruan ",
	"ui.college_ef33db": "Kolehiyo ",
	"ui.text_c3328c": "Teksto",
	"ui.remove_1680e3": "Alisin ang ",
	"ui.tag_outcomes_9af691": "Iugnay ang mga kinalabasan",
	"ui.search_by_name_or_number_63632c": "Maghanap ayon sa pangalan o bilang",
	"ui.search_outcomes_3d2fd6": "Maghanap ng kinalabasan",
	"ui.nothing_matches_019f8e": "Walang tumutugma sa ",
	"ui.clo_coverage_98ba99": "Saklaw ng CLO",
	"ui.untitled_621521": "Walang pamagat",
	"ui.week_a4779a": " linggo",
	"ui.row_9867f6": " hanay",
	"ui.not_covered_yet_3a7d66": "Hindi pa nasasaklaw",
	"ui.wk_1_474a85": "linggo 1",
	"ui.showing_85a4af": "Ipinapakita ang ",
	"ui.rows_that_build_fd23e7": " mga hanay na sumusuporta sa",
	"ui.clear_filter_b667d6": "I-clear ang filter",
	"ui.of_18_7cd558": " sa 18",
	"ui.weeks_covered_use_f7d2f0": " linggong nasasaklaw. Gumamit ng ",
	"ui.for_bullets_and_58b7a5": " para sa mga bullet at ",
	"ui.bold_40b7d4": "**bold**",
	"ui.for_labels_b0d83a": " para sa mga label.",
	"ui.cell_view_163f49": "Anyo ng cell",
	"ui.edit_530164": "Baguhin",
	"ui.formatted_f26356": "May format",
	"ui.week_f82be6": "Linggo",
	"ui.intended_learning_outcomes_7e7669": "Mga inaasahang kinalabasan ng pagkatuto",
	"ui.course_contents_1b687b": "Nilalaman ng kurso",
	"ui.learning_activities_87fc76": "Mga gawain sa pagkatuto",
	"ui.assessment_tasks_795936": "Mga gawain sa pagtataya",
	"ui.values_to_integrate_bf0acd": "Mga pagpapahalagang isasama",
	"ui.wk_1e49a0": "Linggo ",
	"ui.row_type_91d899": "Uri ng hanay",
	"ui.lesson_0bb7c8": "ARALIN",
	"ui.exam_c7e542": "PAGSUSULIT",
	"ui.move_up_b4f57c": "Ilipat pataas",
	"ui.move_down_260ff8": "Ilipat pababa",
	"ui.duplicate_row_d66d5f": "Kopyahin ang hanay",
	"ui.delete_row_fcf3f8": "Burahin ang hanay",
	"ui.review_of_topics_235cbc": "Pagbabalik-aral sa mga paksa",
	"ui.review_topics_520343": "Mga paksang babalikan",
	"ui.ilo_080517": "ILO",
	"ui.start_with_a_verb_6b1d63": "Magsimula sa pandiwa",
	"ui.ilo_f12fa1": "ILO ",
	"ui.of_week_60075b": " ng linggo ",
	"ui.tag_outcomes_for_ilo_5f768a": "Iugnay ang mga kinalabasan para sa ILO ",
	"ui.tag_eae765": "+ Iugnay",
	"ui.remove_ilo_4d0e7b": "Alisin ang ILO",
	"ui.ilo_b41960": "+ ILO",
	"ui.no_rows_build_this_clo_yet_tag_an_ilo_with_it_or_clear_the_filter_f917f8": "Wala pang hanay na sumusuporta sa CLO na ito. Iugnay ito sa isang ILO, o i-clear ang filter.",
	"ui.no_rows_yet_a2e4b6": "Wala pang hanay.",
	"ui.add_week_3a833d": "+ Magdagdag ng linggo",
	"ui.add_exam_row_19d3c0": "+ Magdagdag ng hanay ng pagsusulit",
	"ui.not_applicable_67c4d0": "Hindi naaangkop",
	"ui.marked_not_applicable_for_this_course_b1c227": "Minarkahang hindi naaangkop sa kursong ito.",
	"ui.reference_db1c78": "Sanggunian",
	"ui.reference_523d48": " sanggunian ",
	"ui.more_than_10_years_older_than_school_year_0390a8": "Higit sa 10 taon bago ang taong panuruan ",
	"ui.yrs_a00f7d": " taon",
	"ui.remove_reference_629558": "Alisin ang sanggunian",
	"ui.add_reference_081ae6": "+ Magdagdag ng sanggunian",
	"ui.requirement_e9c366": "Kinakailangan",
	"ui.requirement_15c842": "Kinakailangan ",
	"ui.remove_requirement_425573": "Alisin ang kinakailangan",
	"ui.add_requirement_a73fac": "+ Magdagdag ng kinakailangan",
	"ui.enter_adds_the_next_line_10a028": " Pindutin ang Enter upang magdagdag ng susunod na linya.",
	"ui.from_your_assessment_tasks_in_step_3_860593": "Mula sa iyong mga gawain sa pagtataya sa hakbang 3",
	"ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3": "Hindi tinanggap ng server ang pagpasa. Ayusin muna ang mga ito:",
	"ui.step_status_dc70c2": "Kalagayan ng hakbang",
	"ui.and_97e211": "at ",
	"ui.more_84b30f": " pa",
	"ui.sign_off_91a02d": "Pagpapatibay",
	"ui.prepared_by_47b758": "Inihanda ni",
	"ui.from_your_account_870e41": ", mula sa iyong account",
	"ui.checked_and_reviewed_by_e4719b": "Sinuri at nirepaso ni",
	"ui.added_by_the_system_on_review_24a39a": "Awtomatikong idinaragdag sa pagsusuri",
	"ui.approved_by_b95366": "Inaprubahan ni",
	"ui.added_by_the_system_on_approval_9614af": "Awtomatikong idinaragdag sa pag-apruba",
	"ui.the_other_names_and_the_revision_date_are_added_by_the_system_whe_0aa097": "Awtomatikong idinaragdag ang iba pang pangalan at petsa ng rebisyon kapag sinuri at inaprubahan ang silabus. Hindi mo kailangang punan ang mga ito.",
	"ui.what_did_you_change_required_c57040": "Ano ang binago mo? (kailangan)",
	"ui.what_changed_optional_8668e0": "Ano ang nabago? (opsiyonal)",
	"ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9": "Itinatala kasama ng bersiyong ito sa kasaysayan, hal. Binago ang mga bahagi ng pagmamarka",
	"ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338": "Sumulat ng kahit isang pangungusap upang malaman ng tagasuri kung ano ang dapat tingnan.",
	"ui.only_pdf_files_are_accepted_b07af1": "Mga PDF file lamang ang tinatanggap.",
	"ui.that_file_is_larger_than_10mb_1b3a23": "Lampas sa 10 MB ang file na iyon.",
	"ui.upload_a_file_db7dd1": "MAG-UPLOAD NG FILE",
	"ui.submit_your_syllabus_as_a_pdf_b41730": "Ipasa ang iyong silabus bilang PDF",
	"ui.use_this_when_your_syllabus_is_already_finished_the_pdf_is_what_r_cf6dfc": "Gamitin ito kung tapos na ang iyong silabus. Ang PDF ang babasahin ng mga tagasuri, kaya hindi na kailangan ang form.",
	"ui.choose_the_subject_first_so_the_syllabus_is_filed_under_the_right_54e15b": " Piliin muna ang asignatura upang maitala ang silabus sa tamang kurso.",
	"ui.choose_it_in_the_form_c92099": "Piliin ito sa form",
	"ui.click_or_drop_to_replace_95d96b": " • I-click o ihulog upang palitan",
	"ui.drag_and_drop_your_syllabus_here_or_click_to_choose_5b8cda": "I-drag at ihulog ang iyong silabus dito, o i-click upang pumili",
	"ui.pdf_only_max_10mb_daa870": "PDF lamang • Hanggang 10 MB",
	"ui.preview_f1fbb2": "Paunang tingin",
	"ui.open_in_a_new_tab_b22f39": "Buksan sa bagong tab",
	"ui.preview_of_the_selected_pdf_1b26e7": "Paunang tingin sa napiling PDF",
	"ui.note_for_the_reviewer_optional_201228": "Tala para sa tagasuri (opsiyonal)",
	"ui.anything_the_reviewer_should_know_344e5b": "Anumang dapat malaman ng tagasuri",
	"ui.this_file_will_be_submitted_as_your_syllabus_anything_you_filled__2684db": "Ipapasa ang file na ito bilang iyong silabus. Mananatiling draft ang anumang napunan mo sa form at hindi ito kasama sa ipapasa.",
	"ui.uploading_d921a7": "Ina-upload…",
	"ui.upload_as_new_version_77fd0e": "I-upload bilang bagong bersiyon",
	"ui.submit_for_review_f7710d": "Ipasa para sa pagsusuri",
	"ui.loading_comments_a1458a": "Nilo-load ang mga komento…",
	"ui.no_comments_yet_207b24": "Wala pang komento.",
	"ui.reviewer_a74f16": "Tagasuri",
	"ui.new_6403f2": "Bago",
	"ui.add_a_comment_for_the_faculty_member_3f0231": "Magdagdag ng komento para sa guro…",
	"ui.new_comment_af65ae": "Bagong komento",
	"ui.adding_ffb2e6": "Idinaragdag…",
	"ui.add_comment_7d3764": "Magdagdag ng komento",
	"ui.faculty_compliance_monitoring_7b4446": "Pagsubaybay sa pagsunod ng mga guro",
	"ui.track_syllabus_submission_compliance_per_faculty_member_for_pacuc_a8b5e5": "Subaybayan ang pagpasa ng silabus ng bawat guro para sa akreditasyon ng PACUCOA.",
	"ui.approved_4f3fcf": " aprubado • ",
	"ui.under_review_bfad2e": " sinusuri",
	"ui.compliant_c584a3": "Sumusunod",
	"ui.non_compliant_6d126a": "Hindi sumusunod",
	"ui.required_0e7f72": " kinakailangan",
	"ui.missing_09a3b7": "⚠ Kulang ng ",
	"ui.required_syllabus_submissions_2992e9": " kinakailangang ipasang silabus",
	"ui.checked_by_an_administrator_2cf77d": "Sinuri ng administrador",
	"ui.out_of_date_the_syllabus_changed_after_this_check_384297": "Luma na: nabago ang silabus pagkatapos ng pagsusuring ito",
	"ui.standard_f00ef0": "Pamantayan ",
	"ui.checked_e3b884": " · sinuri noong ",
	"ui.contact_hours_a41bbd": "Oras ng klase: ",
	"ui.a_week_about_47d819": " kada linggo, humigit-kumulang ",
	"ui.for_the_term_the_plan_covers_825f4f": " para sa termino. Saklaw ng plano ang ",
	"ui.weeks_ff9807": " linggo.",
	"ui.on_track_464e43": "naaayon sa plano",
	"ui.needs_work_def443": "kailangang ayusin",
	"ui.not_scored_4e720d": "walang marka",
	"ui.these_stop_the_syllabus_from_being_submitted_cff5cf": "Pinipigilan ng mga ito ang pagpasa ng silabus:",
	"ui.recommendations_4faa65": "Mga rekomendasyon",
	"ui.nothing_to_improve_every_check_passed_60de97": "Walang kailangang ayusin: pumasa sa lahat ng pagsusuri.",
	"ui.behind_the_score_db725f": " batayang marka",
	"ui.rule_blocks_submit_a7fc69": "Tuntunin · pumipigil sa pagpasa",
	"ui.rule_78e179": "Tuntunin",
	"ui.year_8cad48": " — Taon ",
	"ui.course_outcomes_a04e0d": "Mga kinalabasan ng kurso",
	"ui.po_eea0c0": "PO",
	"ui.could_not_load_subjects_16ddd6": "Hindi ma-load ang mga asignatura: ",
	"ui.program_p0_created_and_subject_added_add_its_outcomes_below_a9b6e2": "Nagawa ang programang {p0} at naidagdag ang asignatura. Idagdag ang mga kinalabasan nito sa ibaba.",
	"ui.subject_added_add_its_learning_outcomes_below_ad8a1c": "Naidagdag ang asignatura. Idagdag ang mga kinalabasan ng pagkatuto nito sa ibaba.",
	"ui.program_subjects_904de5": "Programa at mga Asignatura",
	"ui.open_a_subject_to_manage_its_program_s_graduate_attributes_and_pr_048ac5": "Buksan ang asignatura upang pamahalaan ang mga katangian ng nagtapos at kinalabasan ng programa, mga kinalabasan ng pagkatuto sa kurso, at bisyon at misyon ng paaralan. Mababasa lamang ito ng guro sa tagabuo ng silabus.",
	"ui.add_subject_cf1347": "+ Magdagdag ng asignatura",
	"ui.program_code_18ae83": "Code ng programa",
	"ui.e_g_bsit_a78cbf": "hal. BSIT",
	"ui.existing_program_fa9fac": "Umiiral na programa",
	"ui.is_a_new_program_and_will_be_created_with_this_subject_d5fa10": " ay bagong programa at gagawin kasama ng asignaturang ito.",
	"ui.program_name_699413": "Pangalan ng programa",
	"ui.e_g_bs_information_technology_898182": "hal. BS Information Technology",
	"ui.subject_code_8e42db": "Code ng asignatura",
	"ui.e_g_it_204_a373a7": "hal. IT 204",
	"ui.subject_title_dce28f": "Pamagat ng asignatura",
	"ui.add_subject_f3ceb3": "Magdagdag ng asignatura",
	"ui.filter_by_program_133f8f": "Salain ayon sa programa",
	"ui.all_programs_982d52": "Lahat ng programa",
	"ui.clos_a33483": "Mga CLO",
	"ui.missing_276f5d": "Kulang: ",
	"ui.setup_incomplete_7eeb25": "Hindi kumpleto ang pag-set up",
	"ui.no_subjects_in_p0_yet_4d9c7b": "Wala pang asignatura sa {p0}.",
	"ui.no_subjects_yet_add_one_to_start_c6c29e": "Wala pang asignatura. Magdagdag ng isa upang magsimula.",
	"ui.welcome_back_1c5b34": "Maligayang pagbabalik!",
	"ui.here_s_what_is_happening_with_your_undergraduate_syllabi_834d17": "Narito ang mga pinakabagong kaganapan sa iyong mga silabus ng undergraduate.",
	"ui.new_syllabus_c4c7a9": "+ Bagong silabus",
	"ui.recent_activity_8aebf3": "Kamakailang aktibidad",
	"ui.clear_logs_7c3089": "I-clear ang talaan",
	"ui.clear_your_activity_from_this_list_nothing_is_deleted_it_only_hid_fb5d0d": "I-clear ang iyong aktibidad sa listahang ito? Walang mabubura: itatago lamang ang iyong mga nagawa hanggang ngayon.",
	"ui.nothing_yet_what_you_upload_submit_and_update_appears_here_f8bbff": "Wala pa. Lalabas dito ang iyong mga pag-upload, pagpasa, at pag-update.",
	"ui.nothing_yet_your_reviews_and_decisions_appear_here_6bd686": "Wala pa. Lalabas dito ang iyong mga pagsusuri at pasya.",
	"ui.submission_status_12db71": "Kalagayan ng pagpasa",
	"ui.approved_41b81e": "Aprubado",
	"ui.submitted_2e0035": "Naipasa",
	"ui.under_review_18afed": "Sinusuri",
	"ui.for_revision_d7500c": "Para baguhin",
	"ui.quick_actions_c40810": "Mga mabilisang gawain",
	"ui.check_a_syllabus_f9c218": "Suriin ang silabus",
	"ui.compliance_overview_f4109d": "Pangkalahatang pagsunod",
	"ui.run_the_compliance_check_in_step_7_of_the_builder_d861f3": "Patakbuhin ang pagsusuri sa pagsunod sa hakbang 7 ng tagabuo",
	"ui.read_the_stored_check_of_each_submitted_syllabus_921a70": "Basahin ang naka-save na pagsusuri ng bawat naipasang silabus",
	"ui.my_syllabi_3da1e8": "Aking mga Silabus",
	"ui.syllabi_in_your_account_732cf8": " silabus sa iyong account",
	"ui.review_pending_syllabi_bf50c2": "Suriin ang mga naghihintay na silabus",
	"ui.submissions_awaiting_review_31080a": " naipasang naghihintay ng pagsusuri",
	"ui.program_compliance_943fac": "Pagsunod ng programa",
	"ui.no_program_data_yet_c5b890": "Wala pang datos ng programa.",
	"ui.ai_quality_snapshot_c296aa": "Buod ng kalidad mula sa AI",
	"ui.format_041a5d": "Format",
	"ui.completeness_778184": "Pagkakumpleto",
	"ui.co_po_9c8106": "CO–PO",
	"ui.assessment_ef136f": "Pagtataya",
	"ui.upcoming_deadlines_b56518": "Mga paparating na takdang petsa",
	"ui.department_syllabus_submission_e11d1e": "Pagpasa ng silabus ng departamento",
	"ui.5_days_remaining_8ac5f5": "5 araw na natitira",
	"ui.program_chair_review_deadline_31a12f": "Takdang pagsusuri ng tagapangulo ng programa",
	"ui.12_days_remaining_650a54": "12 araw na natitira",
	"ui.dean_approval_deadline_addb1a": "Takdang pag-apruba ng dekano",
	"ui.18_days_remaining_fdeccb": "18 araw na natitira",
	"ui.view_and_manage_your_submitted_syllabi_06426e": "Tingnan at pamahalaan ang iyong mga naipasang silabus.",
	"ui.you_can_create_a_syllabus_once_a_subject_is_assigned_to_you_b8383e": " Maaari kang gumawa ng silabus kapag may naitalagang asignatura sa iyo.",
	"ui.updated_c95815": "Na-update ",
	"ui.open_the_reviewer_comments_1c484a": "Buksan ang mga komento ng tagasuri",
	"ui.edit_79cae4": "✎ Baguhin",
	"ui.notes_from_your_reviewer_about_this_syllabus_6ace96": "Mga tala ng tagasuri tungkol sa silabus na ito",
	"ui.comments_e445b9": "▤ Mga komento",
	"ui.new_7cebfd": " bago",
	"ui.in_total_ed532f": " sa kabuuan",
	"ui.a_conversation_with_your_reviewer_0032bd": "Pag-uusap kasama ang iyong tagasuri",
	"ui.message_890761": "✉ Mensahe",
	"ui.history_fefbcc": "◷ Kasaysayan",
	"ui.delete_p0_b3e049": "Burahin ang {p0}",
	"ui.delete_syllabus_db7e53": "Burahin ang silabus?",
	"ui.are_you_sure_you_want_to_delete_p0_this_cannot_be_undone_efea10": "Sigurado ka bang buburahin ang {p0}? Hindi na ito maibabalik.",
	"ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9": "Wala pang silabus. I-click ang \"+ Bagong silabus\" upang magsimula.",
	"ui.report_downloaded_c0e45e": "Na-download ang ulat.",
	"ui.reports_88bc3f": "Mga Ulat",
	"ui.generate_compliance_accreditation_and_historical_reports_for_inst_673ed4": "Gumawa ng mga ulat sa pagsunod, akreditasyon, at kasaysayan para sa pagsusuri ng institusyon.",
	"ui.faculty_compliance_report_91eba7": "Ulat sa pagsunod ng mga guro",
	"ui.download_e4d296": "⇩ I-download",
	"ui.computed_from_live_syllabus_data_5e6cfe": "Kinuwenta mula sa kasalukuyang datos ng silabus.",
	"ui.total_9ac1f4": " kabuuan",
	"ui.approved_cd0fee": " aprubado",
	"ui.accreditation_audit_summary_aa0020": "Buod ng akreditasyon at audit",
	"ui.total_syllabi_6ef623": "Kabuuang silabus",
	"ui.compliance_68f0ae": "Pagsunod",
	"ui.pacucoa_accreditation_report_generated_for_institutional_complian_60dc81": "Ulat sa Akreditasyon ng PACUCOA — ginawa para sa pagsusuri ng pagsunod ng institusyon.",
	"ui.historical_exports_5581a0": "Mga naunang export",
	"ui.preparing_download_demo_089194": "Inihahanda ang pag-download (demo).",
	"ui.semester_1_final_compliance_xlsx_df9ccf": "📄 Semester_1_Final_Compliance.xlsx ⇩",
	"ui.ched_regional_alignment_report_pdf_f98de5": "📄 CHED_Regional_Alignment_Report.pdf ⇩",
	"ui.department_audit_q4_pdf_3d917b": "📄 Department_Audit_Q4.pdf ⇩",
	"ui.syllabus_repository_95d8eb": "Imbakan ng Silabus",
	"ui.search_and_access_your_syllabi_approved_by_an_administrator_112b87": "Hanapin at buksan ang iyong mga silabus na aprubado ng administrador.",
	"ui.search_and_access_current_and_archived_syllabus_versions_across_u_c4cc77": "Hanapin at buksan ang kasalukuyan at naka-archive na bersiyon ng silabus mula sa mga programang undergraduate.",
	"ui.repository_export_prepared_demo_02ceb3": "Naihanda ang export ng imbakan (demo).",
	"ui.export_list_b039ae": "⇩ I-export ang listahan",
	"ui.all_6a7208": "Lahat",
	"ui.search_bce064": "Hanapin",
	"ui.course_code_title_or_faculty_1878e5": "Code ng kurso, pamagat o guro",
	"ui.approved_afd61f": "Aprubado ",
	"ui.all_255db9": "Lahat ",
	"ui.course_d82b56": "Kurso",
	"ui.updated_f2f857": "Na-update",
	"ui.actions_c3cd63": "Mga aksiyon",
	"ui.open_chat_for_p0_633dd9": "Buksan ang chat para sa {p0}",
	"ui.view_history_for_p0_46396f": "Tingnan ang kasaysayan para sa {p0}",
	"ui.unable_to_load_approved_syllabi_cd0cc5": "Hindi ma-load ang mga aprubadong silabus: ",
	"ui.loading_approved_syllabi_3ad229": "Nilo-load ang mga aprubadong silabus…",
	"ui.no_approved_syllabi_yet_your_syllabus_will_appear_here_once_an_ad_b167c3": "Wala pang aprubadong silabus. Lalabas dito ang iyong silabus kapag inaprubahan ito ng administrador.",
	"ui.no_syllabi_match_your_filters_e09598": "Walang silabus na tumutugma sa iyong mga filter.",
	"ui.review_approval_c4c871": "Pagsusuri at Pag-apruba",
	"ui.open_a_submission_to_read_it_then_approve_it_return_it_for_revisi_2dbe01": "Buksan at basahin ang naipasa, pagkatapos ay aprubahan, ibalik para baguhin, o tanggihan ito.",
	"ui.pending_b6d850": " Naghihintay",
	"ui.waiting_for_the_ai_checker_check_37ebe7": " naghihintay sa Tagasuri ng AI. Suriin muna ang ",
	"ui.there_first_then_9f79fd": " doon; pagkatapos ay ",
	"ui.here_for_your_decision_b13f6c": " rito para sa iyong pasya.",
	"ui.open_the_ai_checker_ea8956": "Buksan ang Tagasuri ng AI",
	"ui.search_faculty_program_or_subject_92ad4a": "Maghanap ng guro, programa o asignatura",
	"ui.search_the_review_board_b45456": "Maghanap sa lupon ng pagsusuri",
	"ui.all_caught_up_no_pending_syllabi_88b06d": "Tapos na ang lahat! Walang naghihintay na silabus.",
	"ui.no_syllabus_matches_ade270": "Walang silabus na tumutugma sa “",
	"ui.could_not_load_the_program_outcomes_for_this_syllabus_a4ad37": "Hindi ma-load ang mga kinalabasan ng programa para sa silabus na ito: ",
	"ui.loading_the_syllabus_79e1d4": "Nilo-load ang silabus…",
	"ui.this_submission_has_not_been_checked_in_the_ai_checker_yet_check__0291cf": "Hindi pa nasusuri ang naipasang ito sa Tagasuri ng AI. Suriin muna ito roon, pagkatapos ay bumalik upang basahin at magpasya.",
	"ui.this_syllabus_is_b75bb9": "Ang silabus na ito ay ",
	"ui.there_is_nothing_to_decide_e4fd66": ". Walang kailangang pagpasyahan.",
	"ui.note_to_the_faculty_member_07d0ce": "Tala para sa guro",
	"ui.optional_for_approval_required_to_return_for_revision_or_reject_ce4884": "Opsiyonal sa pag-apruba. Kailangan kapag ibinabalik para baguhin o tinatanggihan.",
	"ui.confirm_decision_a3ca00": "Kumpirmahin ang pasya",
	"ui.confirm_04a212": "Kumpirmahin",
	"ui.revision_history_b9d26d": "Kasaysayan ng mga rebisyon",
	"ui.settings_saved_f133b2": "Na-save ang mga setting.",
	"ui.could_not_update_your_profile_please_try_again_b453df": "Hindi ma-update ang iyong profile. Subukan muli.",
	"ui.settings_c7f73b": "Mga Setting",
	"ui.manage_your_profile_and_preferences_effe10": "Pamahalaan ang iyong profile at mga kagustuhan.",
	"ui.my_profile_9ba8d3": "Aking Profile",
	"ui.profile_picture_aeb837": "Larawan sa profile",
	"ui.upload_photo_69abef": "Mag-upload ng larawan",
	"ui.more_profile_photo_actions_5f34f0": "Iba pang aksiyon sa larawan sa profile",
	"ui.profile_photo_actions_32a191": "Mga aksiyon sa larawan sa profile",
	"ui.sync_google_workspace_photo_2dd636": "I-sync ang larawan sa Google Workspace",
	"ui.updating_profile_f2060f": "Ina-update ang profile…",
	"ui.jpeg_png_or_webp_up_to_5_mb_7e66fd": "JPEG, PNG o WebP · Hanggang 5 MB",
	"ui.first_name_7e568a": "Pangalan",
	"ui.last_name_adec36": "Apelyido",
	"ui.save_profile_909bf3": "I-save ang Profile",
	"ui.edit_profile_cd280a": "Baguhin ang Profile",
	"ui.language_89b86a": "Wika",
	"ui.choose_the_language_used_throughout_the_system_your_preference_is_312fa8": "Piliin ang wikang gagamitin sa buong sistema. Awtomatikong ise-save ang iyong pinili.",
	"ui.display_language_73de4c": "Wika ng interface",
	"ui.could_not_save_your_language_preference_please_try_again_479b33": "Hindi ma-save ang iyong napiling wika. Subukan muli.",
	"ui.english_649df0": "English",
	"ui.tagalog_68ddd9": "Tagalog",
	"ui.saving_language_preference_e4f88d": "Isine-save ang napiling wika…",
	"ui.language_preference_saved_automatically_b4db96": "Awtomatikong nase-save ang napiling wika.",
	"ui.loading_administrator_settings_ce3873": "Nilo-load ang mga setting ng administrador…",
	"ui.institutional_standard_2f4462": "Pamantayan ng Institusyon",
	"ui.default_syllabus_template_6c0a16": "Default na template ng silabus",
	"ui.undergraduate_syllabus_v4_7600c5": "Silabus ng Undergraduate v4",
	"ui.undergraduate_syllabus_v3_3225ea": "Silabus ng Undergraduate v3",
	"ui.default_academic_year_9141f3": "Default na taong panuruan",
	"ui.default_department_86b0e7": "Default na departamento",
	"ui.ai_notifications_35351e": "AI at mga Abiso",
	"ui.ai_compliance_checking_df4d0c": "Pagsusuri sa pagsunod gamit ang AI",
	"ui.enable_automated_syllabus_quality_checks_95e692": "I-enable ang awtomatikong pagsusuri sa kalidad ng silabus.",
	"ui.strict_format_validation_8d19a0": "Mahigpit na pagsusuri ng format",
	"ui.require_all_template_sections_before_submission_f069fd": "Kailangang kumpleto ang lahat ng bahagi ng template bago magpasa.",
	"ui.email_notifications_128113": "Mga abiso sa email",
	"ui.notify_users_about_review_and_revision_updates_119ca1": "Abisuhan ang mga user tungkol sa pagsusuri at mga rebisyon.",
	"ui.saving_settings_984f7f": "Isine-save ang mga setting…",
	"ui.save_settings_0022a3": "I-save ang mga Setting",
	"ui.student_71ad6e": "ESTUDYANTE",
	"ui.welcome_a2513b": "Maligayang pagdating, ",
	"ui.loading_your_profile_f1468e": "Nilo-load ang iyong profile...",
	"ui.unsaved_changes_292672": "Mga pagbabagong hindi pa naka-save",
	"ui.all_changes_saved_9595b7": "Naka-save na ang lahat ng pagbabago",
	"ui.this_was_changed_by_someone_else_reload_to_see_the_latest_88df1e": "Binago ito ng ibang user. Mag-reload upang makita ang pinakabago. ",
	"ui.reload_cce715": "Mag-reload",
	"ui.vision_and_mission_saved_they_apply_to_every_program_81a32f": "Na-save ang bisyon at misyon. Ilalapat ang mga ito sa lahat ng programa.",
	"ui.the_institution_s_vision_ebcc2a": "Bisyon ng institusyon",
	"ui.mission_introduction_873ac6": "Misyon, panimula",
	"ui.mission_introduction_8acfc4": "Panimula ng misyon",
	"ui.programs_and_services_that_will_enable_them_to_2162c1": "... mga programa at serbisyong magbibigay-daan upang:",
	"ui.mission_statements_5e2923": "Mga pahayag ng misyon",
	"ui.mission_statement_45b2a8": "Pahayag ng misyon ",
	"ui.mission_statement_0ccc0c": "Pahayag ng misyon",
	"ui.remove_statement_100039": "Alisin ang pahayag",
	"ui.add_mission_statement_0ad1c2": "+ Magdagdag ng pahayag ng misyon",
	"ui.p0_egas_saved_aed4ac": "Na-save ang mga EGA ng {p0}.",
	"ui.the_number_is_fixed_once_saved_program_outcomes_and_clos_point_at_b96124": "Hindi na mababago ang bilang kapag na-save: ginagamit ito ng mga kinalabasan ng programa at CLO. Hindi maaaring alisin ang ginagamit pa.",
	"ui.full_name_eeb692": "Buong pangalan",
	"ui.name_of_ega_3dfa90": "Pangalan ng EGA ",
	"ui.short_name_feb5a9": "Maikling pangalan",
	"ui.short_name_of_ega_231166": "Maikling pangalan ng EGA ",
	"ui.remove_ega_8c32e7": "Alisin ang EGA ",
	"ui.add_ega_270a20": "+ Magdagdag ng EGA",
	"ui.p0_program_outcomes_saved_7fd0a0": "Na-save ang mga kinalabasan ng programa ng {p0}.",
	"ui.the_number_is_fixed_once_saved_one_that_a_subject_s_clo_is_tagged_542d3f": "Hindi na mababago ang bilang kapag na-save. Hindi maaaring alisin ang ginagamit pa ng CLO ng asignatura.",
	"ui.no_program_outcomes_for_3d5a81": "Wala pang kinalabasan ng programa para sa ",
	"ui.yet_faculty_see_an_empty_list_until_you_add_them_6295d9": " . Walang makikitang laman ang mga guro hangga't hindi mo ito nadaragdagan.",
	"ui.short_name_of_po_452bca": "Maikling pangalan ng PO ",
	"ui.statement_of_po_0182b3": "Pahayag ng PO ",
	"ui.full_statement_0c9d6a": "Buong pahayag",
	"ui.egas_supported_by_po_44a405": "Mga EGA na sinusuportahan ng PO ",
	"ui.supports_da0eed": "Sinusuportahan",
	"ui.remove_po_ffe9b3": "Alisin ang PO ",
	"ui.add_program_outcome_cd9147": "+ Magdagdag ng kinalabasan ng programa",
	"ui.learning_outcomes_saved_faculty_see_them_the_next_time_they_open__956f63": "Na-save ang mga kinalabasan ng pagkatuto. Makikita ito ng guro sa susunod na pagbukas ng asignatura.",
	"ui.this_subject_has_no_learning_outcomes_yet_faculty_cannot_tag_thei_0cb03e": "Wala pang kinalabasan ng pagkatuto ang asignaturang ito. Hindi pa maiuugnay ng guro ang mga ILO hangga't hindi mo ito nadaragdagan.",
	"ui.level_of_clo_c01e3f": "Antas ng CLO ",
	"ui.move_clo_baa700": "Ilipat ang CLO ",
	"ui.up_459409": " pataas",
	"ui.down_edbf4b": " pababa",
	"ui.delete_clo_3a0c81": "Burahin ang CLO ",
	"ui.descriptor_e_g_foundational_knowledge_3cc9d7": "Paglalarawan, hal. Batayang Kaalaman",
	"ui.title_of_clo_04eb8b": "Pamagat ng CLO ",
	"ui.statement_of_clo_13551f": "Pahayag ng CLO ",
	"ui.what_students_will_be_able_to_do_b7a91b": "Mga magagawa ng mga estudyante",
	"ui.ega_10b364": "+ EGA",
	"ui.po_279301": "+ PO",
	"ui.the_program_outcomes_you_chose_support_de50e2": "Sinusuportahan ng mga napili mong kinalabasan ng programa ang ",
	"ui.ega_aa8fbe": "+ EGA ",
	"ui.add_clo_0485ad": "+ Magdagdag ng CLO",
	"ui.subject_saved_9c680c": "Na-save ang asignatura.",
	"ui.subject_deleted_688bd2": "Nabura ang asignatura.",
	"ui.subject_details_9e2fb9": "Mga detalye ng asignatura",
	"ui.delete_this_subject_95c760": "Burahin ang asignaturang ito",
	"ui.could_not_reload_6fda26": "Hindi ma-reload: ",
	"ui.vision_mission_graduate_attributes_program_outcomes_and_course_le_8288c7": "Bisyon, misyon, mga katangian ng nagtapos, mga kinalabasan ng programa at pagkatuto sa kurso. Mababasa lamang ito ng guro sa tagabuo ng silabus.",
	"ui.setup_incomplete_2c31f4": "Hindi kumpleto ang pag-set up.",
	"ui.faculty_cannot_finish_the_learning_outcomes_step_or_submit_a_syll_e79eee": " Hindi matatapos ng guro ang hakbang ng Mga Kinalabasan ng Pagkatuto o makapagpapasa ng silabus para sa asignaturang ito hangga't hindi naidaragdag ang mga ito: ",
	"ui.could_not_open_the_subject_feb4d2": "Hindi mabuksan ang asignatura: ",
	"ui.each_section_saves_on_its_own_c077f8": "Hiwalay na nase-save ang bawat bahagi.",
	"ui.course_code_e3df14": "Code ng kurso *",
	"ui.course_title_9dfea6": "Pamagat ng kurso *",
	"ui.bsit_7d8d4f": "BSIT",
	"ui.bsis_fba0a3": "BSIS",
	"ui.bscs_ee67dc": "BSCS",
	"ui.blis_dcf8c9": "BLIS",
	"ui.bsemc_3a4792": "BSEMC",
	"ui.semester_3ccdf6": "Semestre *",
	"ui.course_category_44003b": "Kategorya ng kurso",
	"ui.credits_bfac50": "Mga yunit",
	"ui.contact_hours_week_703323": "Oras ng klase / Linggo",
	"ui.course_description_3db6da": "Paglalarawan ng kurso *",
	"ui.syllabus_file_97aaca": "File ng silabus",
	"ui.drag_drop_your_syllabus_file_here_dbc47d": "I-drag at ihulog ang file ng iyong silabus dito",
	"ui.ai_tip_use_measurable_action_verbs_and_align_each_outcome_with_an_ad77ff": " Mungkahi ng AI: Gumamit ng nasusukat na pandiwa at iugnay ang bawat kinalabasan sa pagganap ng estudyanteng maaaring tayain.",
	"ui.co_550729": "CO",
	"ui.add_course_outcome_ef5418": "+ Magdagdag ng kinalabasan ng kurso",
	"ui.topic_content_4891dc": "Paksa / Nilalaman",
	"ui.teaching_learning_activity_16041e": "Gawain sa pagtuturo at pagkatuto",
	"ui.grading_components_631feb": "Mga bahagi ng pagmamarka",
	"ui.class_standing_0a97c9": "Pagganap sa klase",
	"ui.major_assessments_4d7f21": "Mga pangunahing pagtataya",
	"ui.project_performance_96a2d4": "Proyekto / Pagganap",
	"ui.passing_transmutation_cbb7dc": "Pagpasa at pag-convert ng marka",
	"ui.configure_this_section_according_to_the_official_university_gradi_d406c5": "I-configure ang bahaging ito ayon sa opisyal na patakaran sa pagmamarka ng unibersidad.",
	"ui.minimum_passing_percentage_95b265": "Pinakamababang porsiyento upang pumasa",
	"ui.rounding_rule_71d575": "Paraan ng pag-round",
	"ui.nearest_whole_number_78a5b6": "Pinakamalapit na buong bilang",
	"ui.two_decimal_places_702af1": "Dalawang decimal place",
	"ui.2_references_are_more_than_10_years_old_the_ai_checker_will_flag__315174": "⚠ May 2 sangguniang higit sa 10 taong gulang. Itatala ito ng Tagasuri ng AI para sa pagsusuri ng pagiging napapanahon.",
	"ui.add_reference_75edb4": "+ Magdagdag ng Sanggunian",
	"ui.attendance_b68931": "Pagdalo",
	"ui.students_are_expected_to_comply_with_university_attendance_and_ma_44694a": "Inaasahang susunod ang mga estudyante sa mga patakaran ng unibersidad sa pagdalo at paghabol sa mga gawain.",
	"ui.academic_integrity_e62c79": "Katapatan sa akademiko",
	"ui.all_outputs_must_observe_proper_attribution_ethical_use_of_ai_too_11d355": "Dapat may wastong pagkilala sa pinagmulan, etikal na paggamit ng AI, at katapatan sa akademiko ang lahat ng output.",
	"ui.data_privacy_fd595e": "Pagkapribado ng datos",
	"ui.datasets_containing_personal_information_must_be_handled_accordin_845581": "Dapat pangasiwaan ang mga dataset na may personal na impormasyon ayon sa mga patakaran ng institusyon sa pagkapribado.",
	"ui.accessibility_inclusion_0211a1": "Accessibility at inklusyon",
	"ui.reasonable_learning_accommodations_shall_be_coordinated_through_t_306100": "Makipag-ugnayan sa angkop na tanggapan ng unibersidad para sa makatuwirang tulong sa pagkatuto.",
	"ui.draft_saved_to_this_browser_ecd4c5": "Na-save ang draft sa browser na ito.",
	"ui.file_attached_p0_0b74e7": "Na-attach ang file: {p0}",
	"ui.create_a_standards_aligned_syllabus_using_a_guided_institutional__8a7040": "Gumawa ng silabus na sumusunod sa pamantayan gamit ang ginabayang template ng institusyon.",
	"ui.save_draft_cc1316": "I-save ang draft",
	"ui.preview_generated_demo_a76695": "Nagawa ang paunang tingin (demo).",
	"ui.submit_for_review_123f6c": "Ipasa para sa Pagsusuri",
	"ui.semester_788454": "Semestre",
	"ui.draft_23d33e": "Draft",
	"ui.this_syllabus_is_under_review_be53e1": "Kasalukuyang sinusuri ang silabus na ito. ",
	"ui.your_changes_are_saved_as_a_new_version_552d76": "Nase-save ang iyong mga pagbabago bilang bagong bersiyon (",
	"ui.current_405ab5": "kasalukuyan",
	"ui.stays_in_the_history_2340b8": " ay mananatili sa kasaysayan)",
	"ui.and_the_reviewer_is_notified_7b40ef": " at aabisuhan ang tagasuri",
	"ui.only_the_title_course_code_curriculum_and_attached_file_are_versi_1b38fd": ". Pamagat, code ng kurso, kurikulum, at naka-attach na file lamang ang may mga bersiyon; hindi naka-save sa server ang iba pang field sa editor na ito.",
	"ui.auto_save_enabled_e07e38": " Naka-enable ang awtomatikong pag-save",
	"ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_ru_c5ec32": "Itinatala kasama ng bersiyong ito sa kasaysayan, hal. Binago ang pamantayan sa pagmamarka",
	"ui.previous_471492": "← Nakaraan",
	"ui.save_next_fe34ca": "I-save at Susunod →",
	"ui.finish_editing_9f0a56": "Tapusin ang pagbabago",
	"ui.user_created_their_username_and_a_temporary_password_were_sent_to_c6e730": "Nagawa ang user. Ipinadala ang kanilang username at pansamantalang password sa ",
	"ui.user_created_but_no_email_was_sent_161a02": "Nagawa ang user, ngunit walang naipadalang email. ",
	"ui.use_resend_credentials_once_it_works_7a3632": " Gamitin ang \"Ipadala muli ang kredensiyal\" kapag gumagana na ito.",
	"ui.new_credentials_sent_to_cca8dd": "Naipadala ang bagong kredensiyal sa ",
	"ui.nothing_was_changed_the_email_could_not_be_sent_3b7ba4": "Walang nabago: hindi maipadala ang email. ",
	"ui.user_removed_f2fdb9": "Naalis ang user.",
	"ui.users_roles_972dae": "Mga User at Tungkulin",
	"ui.only_users_listed_here_can_sign_in_remove_a_user_to_revoke_their__f115b1": "Ang mga user lamang na nakalista rito ang maaaring mag-sign in. Alisin ang user upang bawiin ang access.",
	"ui.pre_register_user_2fa046": "+ Magrehistro ng User",
	"ui.first_name_b6ea99": "Pangalan",
	"ui.juan_c5652d": "Juan",
	"ui.last_name_863cb3": "Apelyido",
	"ui.santos_cdb56f": "Santos",
	"ui.institutional_email_29be78": "Email sa institusyon",
	"ui.name_email_lcup_edu_ph_2475c2": "name@email.lcup.edu.ph",
	"ui.an_institutional_address_ending_in_email_lcup_edu_ph_6749cb": "Address ng institusyon na nagtatapos sa @email.lcup.edu.ph",
	"ui.role_c3f104": "Tungkulin",
	"ui.save_efc007": "I-save",
	"ui.a_temporary_password_is_generated_and_emailed_to_the_user_with_th_9bb144": "Gumagawa ng pansamantalang password at ipinapadala ito sa email kasama ng username (ang email address na nagtatapos sa @email.lcup.edu.ph). Pipili sila ng sarili nilang password sa unang pag-sign in.",
	"ui.user_9f8a23": "User",
	"ui.email_84add5": "Email",
	"ui.permissions_d06d55": "Mga pahintulot",
	"ui.resend_credentials_1ba6fd": "Ipadala muli ang kredensiyal",
	"ui.remove_e96390": "Alisin",
	"ui.no_users_found_e611ef": "Walang nahanap na user."
};
//#endregion
//#region src/i18n/extra.js
const extraEn = {
	"system.dashboard_d87f47": "Dashboard",
	"system.syllabus_builder_a96252": "Syllabus Builder",
	"system.ai_checker_afc99a": "AI Checker",
	"system.repository_312386": "Repository",
	"system.analytics_25bc96": "Analytics",
	"system.academics_administrator_a34264": "Academics Administrator",
	"system.full_access_5e4017": "Full access",
	"system.create_submit_ec1174": "Create + Submit",
	"system.my_submissions_282583": "My Submissions",
	"system.total_uploaded_dd48c1": "Total uploaded",
	"system.accepted_syllabi_599e98": "Accepted syllabi",
	"system.pending_review_9aab7f": "Pending Review",
	"system.awaiting_decision_c3edf4": "Awaiting decision",
	"system.needs_changes_98f291": "Needs changes",
	"system.ai_compliance_score_296f1c": "AI Compliance Score",
	"system.your_compliance_rate_cdd401": "Your compliance rate",
	"system.total_courses_7a0d46": "Total Courses",
	"system.all_syllabi_5accd3": "All syllabi",
	"system.submitted_syllabi_00ae9f": "Submitted Syllabi",
	"system.awaiting_review_5a5a12": "Awaiting review",
	"system.under_review_7e3e17": "Under review",
	"system.institutional_average_c9c5db": "Institutional average",
	"system.view_report_7398c9": "View report",
	"system.view_analytics_7ad995": "View analytics",
	"system.average_15f86c": "Average",
	"system.complete_1f5a1a": "Complete",
	"system.references_5d20d0": "References",
	"system.decision_7f59a1": "Decision",
	"system.comments_fce06e": "Comments",
	"system.rejected_27eeb7": "Rejected",
	"system.returned_870770": "Returned",
	"system.approve_syllabus_3e6f34": "Approve syllabus",
	"system.locks_it_from_further_edits_96d0e7": "Locks it from further edits",
	"system.approve_this_syllabus_it_will_be_locked_from_further_edits_ca25e9": "Approve this syllabus? It will be locked from further edits.",
	"system.return_for_revision_44d630": "Return for revision",
	"system.the_faculty_member_edits_and_resubmits_1640a9": "The faculty member edits and resubmits",
	"system.return_this_syllabus_to_the_faculty_member_for_revision_76a8c8": "Return this syllabus to the faculty member for revision?",
	"system.reject_2b03b5": "Reject",
	"system.closes_this_submission_5bbbbf": "Closes this submission",
	"system.reject_this_syllabus_the_faculty_member_is_told_why_dd26e6": "Reject this syllabus? The faculty member is told why.",
	"system.choose_a_decision_6a8df6": "Choose a decision.",
	"system.say_why_it_is_rejected_at_least_count_characters_d5c0cd": "Say why it is rejected (at least {count} characters).",
	"system.say_what_needs_to_change_at_least_count_characters_798146": "Say what needs to change (at least {count} characters).",
	"system.comment_153d7a": "Comment",
	"system.revision_request_f081be": "Revision request",
	"system.rejection_6f178e": "Rejection",
	"system.approval_8cc047": "Approval",
	"system.returned_for_revision_871cf5": "Returned for revision",
	"system.course_code_e5c57b": "course code",
	"system.syllabus_content_f0d5ce": "syllabus content",
	"system.this_syllabus_was_submitted_as_an_uploaded_file_so_there_is__9efe78": "This syllabus was submitted as an uploaded file, so there is no builder form to show. Open the file below.",
	"system.this_syllabus_has_no_builder_form_and_no_uploaded_file_store_6fa312": "This syllabus has no builder form and no uploaded file stored with it, so there is nothing to show here.",
	"system.untitled_syllabus_9ad551": "Untitled syllabus",
	"system.you_905cb3": "You",
	"system.someone_35bb09": "Someone",
	"system.today_24345a": "Today",
	"system.yesterday_da2483": "Yesterday",
	"system.a_syllabus_c19cde": "a syllabus",
	"system.approved_c9560d": "approved",
	"system.returned_for_revision_1c5609": "returned for revision",
	"system.rejected_1f087a": "rejected",
	"system.submitted_fda437": "submitted",
	"system.uploaded_f40369": "uploaded",
	"system.updated_13a189": "updated",
	"system.deleted_b639f5": "deleted",
	"system.made_a_change_to_dfb4d4": "made a change to",
	"system.at_least_8_characters_with_a_letter_and_a_number_22b303": "At least 8 characters, with a letter and a number.",
	"system.invalid_email_or_password_01126f": "Invalid email or password.",
	"system.google_sign_in_failed_c0aae7": "Google sign-in failed.",
	"system.sign_in_with_google_4a0b72": "Sign in with Google",
	"system.could_not_load_google_sign_in_17e7fa": "Could not load Google Sign-In.",
	"system.google_sign_in_is_not_configured_missing_vite_google_client__d9cfd5": "Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).",
	"system.google_photo_access_was_not_granted_please_try_again_fe9573": "Google photo access was not granted. Please try again.",
	"system.google_photo_sync_was_cancelled_your_current_photo_has_been__a60095": "Google photo sync was cancelled. Your current photo has been kept.",
	"system.could_not_open_google_photo_sync_allow_popups_for_this_site__0ac9f9": "Could not open Google photo sync. Allow popups for this site and try again.",
	"system.could_not_start_google_photo_sync_please_try_again_15d1de": "Could not start Google photo sync. Please try again.",
	"system.google_photo_sync_is_not_configured_contact_your_administrat_07c7e0": "Google photo sync is not configured. Contact your administrator.",
	"system.google_photo_sync_is_still_loading_please_try_again_3a7907": "Google photo sync is still loading. Please try again.",
	"system.profile_changes_saved_a4f461": "Profile changes saved.",
	"system.google_workspace_photo_synced_bbc91c": "Google Workspace photo synced.",
	"system.cannot_reach_the_server_check_that_the_api_is_running_and_tr_d193c0": "Cannot reach the server. Check that the API is running and try again.",
	"system.choose_a_jpeg_png_or_webp_image_7724fb": "Choose a JPEG, PNG or WebP image.",
	"system.that_image_is_over_5_mb_choose_a_smaller_one_ba2698": "That image is over 5 MB. Choose a smaller one.",
	"system.that_file_could_not_be_read_as_an_image_644cb3": "That file could not be read as an image.",
	"system.could_not_process_that_image_cdb958": "Could not process that image.",
	"system.could_not_load_administrator_settings_please_try_again_fd072a": "Could not load administrator settings. Please try again.",
	"system.could_not_save_administrator_settings_please_try_again_0ca0c5": "Could not save administrator settings. Please try again.",
	"system.enter_valid_administrator_settings_66fbc0": "Enter valid administrator settings.",
	"system.choose_english_or_tagalog_1fe6a7": "Choose English or Tagalog.",
	"system.course_information_5f740d": "Course Information",
	"system.learning_outcomes_4f09ca": "Learning Outcomes",
	"system.learning_plan_80b712": "Learning Plan",
	"system.course_requirements_212b44": "Course Requirements",
	"system.grading_system_d227f8": "Grading System",
	"system.review_check_0b1d47": "Review & Check",
	"system.form_804463": "Form",
	"system.identify_the_course_school_year_and_college_are_filled_in_fo_130701": "Identify the course. School year and college are filled in for you.",
	"system.the_institution_s_vision_mission_graduate_attributes_and_pro_8ba434": "The institution’s vision, mission, graduate attributes and program outcomes, then your course learning outcomes tagged to them.",
	"system.one_row_per_week_or_week_range_tag_every_ilo_with_the_outcom_a50cb4": "One row per week or week range. Tag every ILO with the outcomes it builds.",
	"system.what_students_must_complete_suggestions_come_from_your_asses_a4f86c": "What students must complete. Suggestions come from your assessment tasks.",
	"system.group_references_the_way_the_form_does_older_sources_are_mar_60031e": "Group references the way the form does. Older sources are marked.",
	"system.components_must_total_100_the_formulas_follow_from_them_and__68f70a": "Components must total 100%. The formulas follow from them and from your exam rows.",
	"system.check_the_finished_form_against_the_template_and_read_it_thr_0a0bd0": "Check the finished form against the template and read it through. Sign-off names are filled in by the system when it is reviewed and approved.",
	"system.weekly_topics_f1b506": "Weekly Topics",
	"system.assessment_plan_130e76": "Assessment Plan",
	"system.policies_8d6118": "Policies",
	"system.introductory_820724": "Introductory",
	"system.enabling_ab6c4d": "Enabling",
	"system.demonstrating_b9a3fc": "Demonstrating",
	"system.integration_of_values_0fb072": "Integration of Values",
	"system.books_4a7fdd": "Books",
	"system.internet_programming_5c3b8a": "Internet Programming",
	"system.internet_references_a92d58": "Internet References",
	"system.electronics_89f1eb": "Electronics",
	"system.undo_39fc72": "Undo",
	"system.save_as_new_version_95073f": "Save as new version",
	"system.submit_2dacf6": "Submit",
	"system.auto_save_enabled_914b94": "Auto-save enabled",
	"system.check_your_connection_7bc817": "Check your connection",
	"system.saving_ae7e88": "Saving...",
	"system.save_outcomes_4bfb7f": "Save outcomes",
	"system.school_wide_all_programs_a4dd79": "School-wide · all programs",
	"system.leave_without_saving_your_assignment_changes_45bdf1": "Leave without saving your assignment changes?",
	"system.close_without_saving_your_changes_94cf16": "Close without saving your changes?",
	"system.edit_this_syllabus_saved_as_a_new_version_d7950d": "Edit this syllabus (saved as a new version)",
	"system.no_clos_yet_add_them_in_step_2_f4fa53": "No CLOs yet. Add them in step 2.",
	"system.no_match_48ee63": "No match.",
	"system.this_program_4e3f0e": "this program",
	"system.no_program_chosen_7421d4": "no program chosen",
	"system.your_latest_changes_could_not_be_saved_so_they_were_not_chec_8fb98e": "Your latest changes could not be saved, so they were not checked.",
	"system.meets_the_standard_ab6a46": "Meets the standard",
	"system.below_the_pass_line_1e4f08": "Below the pass line",
	"system.not_scored_fcaa08": "Not scored",
	"system.rule_based_check_5980c6": "Rule-based check",
	"system.ai_assisted_check_380670": "AI-assisted check",
	"system.ai_unavailable_e98b69": "AI unavailable",
	"system.the_rule_check_is_done_recommendations_are_still_being_writt_1fa552": "The rule check is done. Recommendations are still being written.",
	"system.ai_suggestions_are_not_available_right_now_so_these_recommen_e46f90": "AI suggestions are not available right now, so these recommendations come from the rules.",
	"system.not_enough_written_yet_to_give_a_score_fill_in_more_of_the_f_886164": "Not enough written yet to give a score. Fill in more of the form.",
	"system.check_4b5e84": "Check",
	"system.high_b1a595": "High",
	"system.medium_d40496": "Medium",
	"system.low_a12494": "Low",
	"system.excellent_1aafbf": "Excellent",
	"system.good_61dedc": "Good",
	"system.needs_improvement_379094": "Needs Improvement",
	"system.poor_4e0fa4": "Poor",
	"system.student_id_76b822": "Student ID",
	"system.name_709a23": "Name",
	"system.year_level_7b07b7": "Year level",
	"system.section_f2c6b5": "Section",
	"system.term_770bce": "Term",
	"system.your_compliance_score_ae802b": "Your compliance score",
	"system.pending_reviews_512845": "Pending reviews",
	"system.needs_attention_a12672": "Needs attention",
	"system.tip_d19cec": "Tip",
	"system.use_the_compliance_check_in_step_7_of_the_builder_to_improve_79e065": "Use the compliance check in step 7 of the builder to improve scores before submitting.",
	"system.bsit_has_the_highest_compliance_70e858": "BSIT has the highest compliance",
	"system.93_average_compliance_maintain_current_review_cadence_0dc1ca": "93% average compliance; maintain current review cadence.",
	"system.assessment_alignment_needs_attention_4be3e3": "Assessment alignment needs attention",
	"system.21_of_reviewed_syllabi_have_incomplete_co_to_assessment_mapp_4eb42f": "21% of reviewed syllabi have incomplete CO-to-assessment mapping.",
	"system.references_should_be_refreshed_fa7645": "References should be refreshed",
	"system.32_of_references_are_older_than_ten_years_across_active_syll_dd9aa3": "32% of references are older than ten years across active syllabi.",
	"system.approval_backlog_is_manageable_8c9733": "Approval backlog is manageable",
	"system.18_syllabi_remain_under_review_6_are_already_overdue_2d78eb": "18 syllabi remain under review; 6 are already overdue.",
	"system.count_average_across_total_syllabi_121b42": "{count}% average across {total} syllabi.",
	"system.count_syllabi_currently_under_review_6f4631": "{count} syllabi currently under review.",
	"system.count_syllabi_returned_or_rejected_c37b18": "{count} syllabi returned or rejected.",
	"system.step_number_title_dd7939": "Step {number}: {title}",
	"system.finish_step_number_first_title_bb71fd": "Finish step {number} first: {title}.",
	"system.week_week_deleted_5f67b4": "Week {week} deleted.",
	"system.not_saved_message_be8039": "Not saved. {message}",
	"system.auto_save_enabled_saved_time_da4e35": "Auto-save enabled · saved {time}",
	"system.count_warning_remains_f2ff3f": "{count} warning remains",
	"system.count_warnings_remain_81d33c": "{count} warnings remain",
	"system.count_finding_03de7f": "{count} finding",
	"system.count_findings_215eaf": "{count} findings",
	"system.count_check_e03232": "{count} check",
	"system.count_checks_00f478": "{count} checks",
	"system.showing_range_709ec4": "Showing {range}",
	"system.showing_checks_range_2a0a4c": "Showing checks {range}",
	"system.since_date_86770b": "Since {date}",
	"system.until_date_5a3981": "Until {date}",
	"system.count_problem_stops_this_syllabus_from_being_submitted_0d5c67": "{count} problem stops this syllabus from being submitted.",
	"system.count_problems_stop_this_syllabus_from_being_submitted_d9dedf": "{count} problems stop this syllabus from being submitted.",
	"system.meets_the_standard_pass_line_score_4f78a8": "Meets the standard (pass line {score}%).",
	"system.below_the_pass_line_of_score_you_can_still_submit_the_review_7ef4e7": "Below the pass line of {score}%. You can still submit; the reviewer will see this score.",
	"system.choose_a_program_16a93a": "Choose a program.",
	"system.choose_a_subject_e961b3": "Choose a subject.",
	"system.pre_requisite_is_empty_ad5dc0": "Pre-requisite is empty.",
	"system.enter_lecture_and_laboratory_units_80dd0a": "Enter lecture and laboratory units.",
	"system.add_at_least_one_description_paragraph_4b3384": "Add at least one description paragraph.",
	"system.the_vision_has_not_been_added_yet_please_ask_your_administra_6a29cf": "The vision has not been added yet. Please ask your administrator.",
	"system.the_mission_has_not_been_added_yet_please_ask_your_administr_f2c71b": "The mission has not been added yet. Please ask your administrator.",
	"system.no_graduate_attributes_egas_have_been_added_for_program_yet__3fb769": "No graduate attributes (EGAs) have been added for {program} yet. Please ask your administrator.",
	"system.no_program_outcomes_have_been_added_for_program_yet_please_a_06a2b3": "No program outcomes have been added for {program} yet. Please ask your administrator.",
	"system.no_learning_outcomes_have_been_added_for_subject_yet_please__ecfcd8": "No learning outcomes have been added for {subject} yet. Please ask your administrator.",
	"system.clo_number_has_no_statement_yet_please_ask_your_administrato_204ede": "CLO {number} has no statement yet. Please ask your administrator.",
	"system.clo_number_has_no_graduate_attribute_ega_tag_yet_please_ask__874b3a": "CLO {number} has no graduate attribute (EGA) tag yet. Please ask your administrator.",
	"system.clo_number_has_no_program_outcome_tag_yet_please_ask_your_ad_7fab3e": "CLO {number} has no program outcome tag yet. Please ask your administrator.",
	"system.add_at_least_one_week_ea1bba": "Add at least one week.",
	"system.add_at_least_one_lesson_with_a_learning_outcome_ilo_45d531": "Add at least one lesson with a learning outcome (ILO).",
	"system.a_row_has_no_week_enter_the_week_or_delete_the_row_325fdf": "A row has no week. Enter the week, or delete the row.",
	"system.week_week_has_no_learning_outcome_ilo_3b6183": "Week {week} has no learning outcome (ILO).",
	"system.week_week_ilo_ilo_has_no_clo_tag_dc23a1": "Week {week}, ILO {ilo} has no CLO tag.",
	"system.week_week_ilo_ilo_is_tagged_but_has_no_text_2d9bc6": "Week {week}, ILO {ilo} is tagged but has no text.",
	"system.week_week_ilo_ilo_has_a_tag_that_no_longer_resolves_tag_0dc8d7": "Week {week}, ILO {ilo} has a tag that no longer resolves: {tag}",
	"system.clo_number_is_not_covered_by_any_ilo_yet_234f27": "CLO {number} is not covered by any ILO yet.",
	"system.the_plan_covers_count_of_18_weeks_071ff7": "The plan covers {count} of 18 weeks.",
	"system.list_at_least_3_course_requirements_9e2e96": "List at least 3 course requirements.",
	"system.group_has_no_entries_add_one_or_mark_it_not_applicable_6f5dab": "{group} has no entries. Add one or mark it not applicable.",
	"system.components_total_count_not_100_ac08a7": "Components total {count}%, not 100%.",
	"system.add_grading_components_495ddb": "Add grading components.",
	"system.only_count_of_3_grading_terms_have_an_exam_row_in_the_learni_6f0dba": "Only {count} of 3 grading terms have an exam row in the Learning Plan.",
	"system.override_formulas_cannot_be_empty_d52a12": "Override formulas cannot be empty.",
	"system.this_syllabus_was_submitted_and_is_locked_you_can_edit_it_ag_982333": "This syllabus was submitted and is locked. You can edit it again only if the administrator returns it for revision.",
	"system.this_subject_is_no_longer_assigned_to_you_ca35b5": "This subject is no longer assigned to you.",
	"system.no_program_or_subject_is_assigned_to_you_yet_ask_an_administ_b9d297": "No program or subject is assigned to you yet. Ask an administrator.",
	"system.a_program_is_assigned_to_you_but_no_subject_yet_ask_an_admin_a780fd": "A program is assigned to you, but no subject yet. Ask an administrator.",
	"system.a_draft_has_no_conversation_submit_it_for_review_first_then__882409": "A draft has no conversation. Submit it for review first, then you can message the administrator.",
	"system.send_name_a_new_temporary_password_it_replaces_their_current_f8e59c": "Send {name} a new temporary password? It replaces their current password, and they must choose their own at the next sign-in.",
	"system.remove_name_they_will_no_longer_be_able_to_sign_in_and_their_1276ac": "Remove {name}? They will no longer be able to sign in, and their syllabi will be deleted.",
	"system.delete_clo_number_ilos_in_saved_syllabi_that_are_tagged_with_5e1afb": "Delete CLO {number}? ILOs in saved syllabi that are tagged with it will show the tag as unresolved until faculty fix them.",
	"system.delete_subject_syllabi_that_use_it_keep_the_outcomes_they_we_b64be5": "Delete {subject}? Syllabi that use it keep the outcomes they were saved with, but new drafts can no longer pick it.",
	"system.items_will_be_removed_for_all_count_program_subjects_continu_9fe9b2": "{items} will be removed for all {count} {program} subjects. Continue?",
	"system.email_isn_t_set_up_on_the_server_yet_add_the_smtp_settings_t_0b00f2": "Email isn't set up on the server yet: add the SMTP settings to server/.env and restart it.",
	"system.the_mail_server_rejected_the_username_or_password_in_server__0a92d7": "The mail server rejected the username or password in server/.env.",
	"system.the_mail_server_could_not_be_reached_check_smtp_host_and_smt_776ecc": "The mail server could not be reached. Check SMTP_HOST and SMTP_PORT in server/.env.",
	"system.the_email_could_not_be_sent_see_the_server_log_for_the_reaso_9cb8d8": "The email could not be sent. See the server log for the reason.",
	"system.no_subject_is_assigned_yet_so_they_cannot_start_a_syllabus_u_b8fd22": "No subject is assigned yet, so they cannot start a syllabus until you assign one.",
	"system.topics_covered_c9aa8d": "Topics covered",
	"system.one_per_line_3cfc5d": "- One per line",
	"system.core_value_cee550": "**Core value**",
	"system.examination_e526b8": "- Examination",
	"system.removed_outcome_dd0787": "Removed outcome",
	"system.untitled_outcome_841f6c": "Untitled outcome",
	"system.unknown_tag_2e8a4c": "Unknown tag",
	"system.not_in_the_program_ega_list_88302f": "Not in the {program} EGA list",
	"system.not_in_the_program_list_1689f4": "Not in the {program} list",
	"system.program_only_f0974a": "{program} only",
	"system.program_all_subjects_f2b882": "{program} · all subjects",
	"system.format_compliance_f05ff9": "Format Compliance",
	"system.content_completeness_bd5188": "Content Completeness",
	"system.co_po_alignment_049bbc": "CO–PO Alignment",
	"system.assessment_alignment_c9b632": "Assessment Alignment",
	"system.contact_hours_1d12f9": "Contact Hours",
	"system.reference_currency_7c7576": "Reference Currency",
	"system.needs_work_eafabc": "Needs work",
	"system.prelim_b5db4e": "Prelim",
	"system.midterm_7cdaaa": "Midterm",
	"system.final_672b22": "Final",
	"system.schedule_0a8ada": "Schedule",
	"system.intended_learning_outcomes_ilo_57ef01": "Intended Learning Outcomes (ILO)",
	"system.course_contents_8115c9": "Course Contents",
	"system.suggested_learning_activities_df568c": "Suggested Learning Activities",
	"system.suggested_assessment_tasks_26748f": "Suggested Assessment Tasks",
	"system.expected_value_s_to_be_integrated_786252": "Expected Value/s to be Integrated",
	"system.course_code_i_is_empty_fd348f": "Course code (I) is empty.",
	"system.enter_the_course_code_477e29": "Enter the course code",
	"system.course_title_ii_is_empty_7bb3ba": "Course title (II) is empty.",
	"system.enter_the_course_title_2b2ee7": "Enter the course title",
	"system.program_is_empty_660fdf": "Program is empty.",
	"system.choose_the_program_574ae3": "Choose the program",
	"system.course_description_iii_is_empty_fb57e2": "Course description (III) is empty.",
	"system.write_the_course_description_99aa63": "Write the course description",
	"system.pre_requisite_iv_is_empty_8a7698": "Pre-requisite (IV) is empty.",
	"system.enter_the_pre_requisite_2b9d4e": "Enter the pre-requisite",
	"system.lecture_and_laboratory_units_v_are_not_both_entered_447d6b": "Lecture and laboratory units (V) are not both entered.",
	"system.enter_the_lecture_and_laboratory_units_3a7a57": "Enter the lecture and laboratory units",
	"system.there_are_no_course_learning_outcomes_vi_ff0054": "There are no course learning outcomes (VI).",
	"system.ask_an_administrator_to_add_the_course_learning_outcomes_3bb261": "Ask an administrator to add the course learning outcomes",
	"system.the_learning_plan_vii_has_no_lesson_with_a_learning_outcome__14a16b": "The Learning Plan (VII) has no lesson with a learning outcome (ILO).",
	"system.add_a_lesson_with_a_learning_outcome_ilo_97bd34": "Add a lesson with a learning outcome (ILO)",
	"system.the_vision_in_this_syllabus_is_not_the_school_s_current_visi_595fb5": "The vision in this syllabus is not the school's current vision.",
	"system.resubmit_so_the_syllabus_carries_the_current_vision_02d676": "Resubmit so the syllabus carries the current vision",
	"system.the_mission_in_this_syllabus_is_not_the_school_s_current_mis_2598ae": "The mission in this syllabus is not the school's current mission.",
	"system.resubmit_so_the_syllabus_carries_the_current_mission_c9a873": "Resubmit so the syllabus carries the current mission",
	"system.the_graduate_attributes_egas_in_this_syllabus_are_not_the_pr_7d925f": "The graduate attributes (EGAs) in this syllabus are not the program's current ones.",
	"system.resubmit_so_the_syllabus_carries_the_current_graduate_attrib_1042dc": "Resubmit so the syllabus carries the current graduate attributes",
	"system.the_program_outcomes_pos_in_this_syllabus_are_not_the_progra_289943": "The program outcomes (POs) in this syllabus are not the program's current ones.",
	"system.resubmit_so_the_syllabus_carries_the_current_program_outcome_c781cd": "Resubmit so the syllabus carries the current program outcomes",
	"system.where_has_no_clo_tag_3391d4": "{where} has no CLO tag.",
	"system.tag_every_ilo_with_the_clo_it_builds_a2a692": "Tag every ILO with the CLO it builds",
	"system.where_has_a_tag_that_no_longer_resolves_tag_d45c61": "{where} has a tag that no longer resolves: {tag}.",
	"system.fix_the_outcome_tags_that_no_longer_resolve_7ac93c": "Fix the outcome tags that no longer resolve",
	"system.learning_plan_row_row_is_missing_the_column_missing_e31e3b": "Learning Plan row {row} is missing the column: {missing}.",
	"system.complete_the_learning_plan_columns_569acd": "Complete the Learning Plan columns",
	"system.where_has_nothing_in_missing_0f2c2a": "{where} has nothing in: {missing}.",
	"system.fill_in_the_empty_learning_plan_columns_1b6315": "Fill in the empty Learning Plan columns",
	"system.where_has_an_empty_ilo_before_a_filled_one_so_the_printed_nu_67b7c6": "{where} has an empty ILO before a filled one, so the printed numbering has a gap.",
	"system.remove_the_empty_ilo_between_filled_ones_432f5f": "Remove the empty ILO between filled ones",
	"system.learning_plan_row_row_comes_before_an_earlier_week_f455ca": "Learning Plan row {row} comes before an earlier week.",
	"system.put_the_learning_plan_rows_in_week_order_1c1173": "Put the Learning Plan rows in week order",
	"system.course_requirements_viii_have_listed_at_least_need_needed_3373ac": "Course requirements (VIII): {have} listed, at least {need} needed.",
	"system.list_at_least_three_course_requirements_492883": "List at least three course requirements",
	"system.requirement_text_starts_with_its_own_number_the_form_numbers_cc2545": "Requirement \"{text}\" starts with its own number; the form numbers the list for you.",
	"system.remove_the_typed_numbers_from_the_requirements_778c2b": "Remove the typed numbers from the requirements",
	"system.references_letter_title_has_no_entries_and_is_not_marked_not_db9de6": "References ({letter}. {title}) has no entries and is not marked not applicable.",
	"system.fill_in_each_reference_group_or_mark_it_not_applicable_017773": "Fill in each reference group or mark it not applicable",
	"system.references_letter_title_is_marked_not_applicable_but_has_ent_837d7c": "References ({letter}. {title}) is marked not applicable but has entries.",
	"system.resolve_the_reference_group_marked_not_applicable_that_has_e_7431c1": "Resolve the reference group marked not applicable that has entries",
	"system.the_grading_system_x_has_no_components_6bedcc": "The Grading System (X) has no components.",
	"system.add_the_grading_components_6379f7": "Add the grading components",
	"system.the_grading_components_total_total_not_need_7af3a4": "The grading components total {total}%, not {need}%.",
	"system.make_the_grading_components_total_100_1c1296": "Make the grading components total 100%",
	"system.the_override_formulas_cannot_be_empty_16b132": "The override formulas cannot be empty.",
	"system.fill_in_the_override_formulas_or_switch_them_off_ef3080": "Fill in the override formulas or switch them off",
	"system.the_which_formula_does_not_mention_missing_115864": "The {which} formula does not mention {missing}.",
	"system.make_the_grading_formulas_name_every_component_and_exam_term_254c69": "Make the grading formulas name every component and exam term",
	"system.the_sign_off_block_is_not_as_the_form_requires_problem_e789b0": "The sign-off block is not as the form requires: {problem}.",
	"system.check_the_sign_off_block_a1220a": "Check the sign-off block",
	"system.the_course_description_is_words_nouns_about_need_are_expecte_59286a": "The course description is {words} {nouns}; about {need} are expected.",
	"system.expand_the_course_description_2cc109": "Expand the course description",
	"system.where_is_only_words_nouns_an_ilo_states_what_the_student_wil_6bff9d": "{where} is only {words} {nouns}; an ILO states what the student will do.",
	"system.write_fuller_learning_outcomes_ilos_654df1": "Write fuller learning outcomes (ILOs)",
	"system.clo_n_has_no_missing_e2c4c2": "CLO {n} has no {missing}.",
	"system.ask_an_administrator_to_complete_the_clo_titles_and_statemen_0a783c": "Ask an administrator to complete the CLO titles and statements",
	"system.there_are_have_references_at_least_need_are_expected_52dfcd": "There are {have} references; at least {need} are expected.",
	"system.add_more_references_06d9a2": "Add more references",
	"system.clo_n_is_not_tagged_with_a_valid_graduate_attribute_ega_c6f5fc": "CLO {n} is not tagged with a valid graduate attribute (EGA).",
	"system.ask_an_administrator_to_tag_each_clo_with_graduate_attribute_b65c4f": "Ask an administrator to tag each CLO with graduate attributes",
	"system.clo_n_is_not_tagged_with_a_valid_program_outcome_po_ba7e86": "CLO {n} is not tagged with a valid program outcome (PO).",
	"system.ask_an_administrator_to_tag_each_clo_with_program_outcomes_abd819": "Ask an administrator to tag each CLO with program outcomes",
	"system.clo_n_is_tagged_po_po_which_maps_to_ega_ega_but_ega_ega_is_n_9ce3b8": "CLO {n} is tagged PO {po}, which maps to EGA {ega}, but EGA {ega} is not tagged.",
	"system.ask_an_administrator_to_tag_the_egas_the_pos_imply_e098e4": "Ask an administrator to tag the EGAs the POs imply",
	"system.clo_n_s_tags_would_not_print_as_format_numbers_must_be_uniqu_b8d35a": "CLO {n}'s tags would not print as {format}: numbers must be unique and in order.",
	"system.ask_an_administrator_to_put_the_clo_tags_in_order_b354b9": "Ask an administrator to put the CLO tags in order",
	"system.clo_n_is_not_built_by_any_ilo_in_the_learning_plan_0f9245": "CLO {n} is not built by any ILO in the Learning Plan.",
	"system.cover_every_course_outcome_in_the_learning_plan_73d996": "Cover every course outcome in the Learning Plan",
	"system.where_has_no_assessment_task_1818c7": "{where} has no assessment task.",
	"system.add_an_assessment_task_to_every_lesson_003cd7": "Add an assessment task to every lesson",
	"system.clo_n_is_not_assessed_no_week_that_builds_it_has_an_assessme_45b49b": "CLO {n} is not assessed: no week that builds it has an assessment task.",
	"system.assess_every_course_learning_outcome_d14b14": "Assess every course learning outcome",
	"system.there_is_no_term_examination_row_in_the_learning_plan_816d16": "There is no {term} examination row in the Learning Plan.",
	"system.add_the_missing_examination_rows_6f0651": "Add the missing examination rows",
	"system.the_grading_system_has_no_examination_component_6b9221": "The grading system has no examination component.",
	"system.include_an_examination_in_the_grading_system_55917d": "Include an examination in the grading system",
	"system.the_credit_units_are_not_usable_lecture_lecture_laboratory_l_7c7023": "The credit units are not usable: lecture {lecture}, laboratory {lab}.",
	"system.correct_the_credit_units_6cbf75": "Correct the credit units",
	"system.the_plan_covers_planned_of_expected_weeks_hours_b1a9b0": "The plan covers {planned} of {expected} weeks{hours}.",
	"system.plan_the_full_term_bf8886": "Plan the full term",
	"system.row_row_has_a_week_that_is_not_within_1_to_to_week_88575b": "Row {row} has a week that is not within 1 to {to}: \"{week}\".",
	"system.fix_the_weeks_outside_the_term_c8d435": "Fix the weeks outside the term",
	"system.week_s_weeks_appear_verb_in_more_than_one_row_890453": "Week{s} {weeks} appear{verb} in more than one row.",
	"system.resolve_the_weeks_used_by_more_than_one_row_c697a4": "Resolve the weeks used by more than one row",
	"system.there_are_no_references_bea2c0": "There are no references.",
	"system.add_references_4eb0e8": "Add references",
	"system.a_reference_has_no_year_text_88645f": "A reference has no year: \"{text}\".",
	"system.add_the_year_to_each_reference_7d6b56": "Add the year to each reference",
	"system.a_reference_is_age_years_old_year_the_limit_is_limit_text_51f7a0": "A reference is {age} years old ({year}); the limit is {limit}: \"{text}\".",
	"system.replace_the_outdated_references_2a9002": "Replace the outdated references",
	"system.count_more_like_this_2e9cf6": "{count} more like this.",
	"system.word_44363c": "Word",
	"system.word_3cbcd9": "word",
	"system.words_efb893": "words",
	"system.week_week_971fff": "Week {week}",
	"system.week_week_ilo_ilo_5617d6": "Week {week}, ILO {ilo}",
	"system.row_row_b8e5d8": "Row {row}",
	"system.uploaded_file_8f6beb": "uploaded file",
	"system.submit_anyway_aae672": "Submit anyway",
	"system.save_as_new_version_anyway_cab83b": "Save as new version anyway",
	"system.sep_492c5f": "SEP",
	"system.token_is_required_754957": "token is required",
	"system.google_sign_in_is_not_configured_on_the_server_60dab7": "Google sign-in is not configured on the server.",
	"system.server_is_missing_its_jwt_secret_4d6f02": "Server is missing its JWT secret.",
	"system.google_sign_in_could_not_be_verified_please_try_again_df4f63": "Google sign-in could not be verified. Please try again.",
	"system.access_denied_only_p0_accounts_can_sign_in_e2567b": "Access denied. Only @{p0} accounts can sign in.",
	"system.access_denied_your_account_is_not_registered_in_the_system_1b64a2": "Access Denied. Your account is not registered in the system.",
	"system.sign_in_failed_because_of_a_server_error_please_try_again_e375a1": "Sign-in failed because of a server error. Please try again.",
	"system.access_denied_account_not_registered_5a9a06": "Access Denied. Account not registered.",
	"system.invalid_email_or_password_c0494c": "Invalid email or password",
	"system.your_registration_is_waiting_for_an_administrator_to_verify__1936d8": "Your registration is waiting for an administrator to verify your COR.",
	"system.your_registration_was_rejected_contact_the_administrator_b2590e": "Your registration was rejected. Contact the administrator.",
	"system.logged_out_25edfa": "Logged out",
	"system.enter_the_email_address_you_registered_with_8e2dd3": "Enter the email address you registered with.",
	"system.too_many_requests_try_again_in_6eba4a": "Too many requests. Try again in ",
	"system.minute_s_3bb3d5": "minute(s).",
	"system.account_not_found_9dad66": "Account not found",
	"system.your_current_password_is_not_correct_c8309a": "Your current password is not correct.",
	"system.your_password_was_changed_3c5172": "Your password was changed.",
	"system.the_password_could_not_be_changed_because_of_a_server_error_a06d94": "The password could not be changed because of a server error.",
	"system.not_authenticated_0c91ac": "Not authenticated",
	"system.syllabus_not_found_84d0f7": "Syllabus not found",
	"system.only_the_faculty_member_who_owns_the_syllabus_reads_its_comm_12f062": "Only the faculty member who owns the syllabus reads its comments",
	"system.only_administrators_can_add_reviewer_comments_1482e8": "Only administrators can add reviewer comments",
	"system.new_reviewer_comment_p0_456700": "New reviewer comment: {p0}",
	"system.your_syllabus_9346a1": "your syllabus",
	"system.must_be_a_valid_date_b521a8": "must be a valid date",
	"system.only_an_administrator_can_read_the_check_history_3a67e4": "Only an administrator can read the check history",
	"system.only_the_owner_or_an_administrator_can_check_a_syllabus_7b9c8a": "Only the owner or an administrator can check a syllabus",
	"system.there_is_nothing_to_check_yet_save_some_of_the_form_first_819809": "There is nothing to check yet. Save some of the form first.",
	"system.you_are_checking_too_often_try_again_in_c75a7d": "You are checking too often. Try again in ",
	"system.seconds_07ba64": "seconds.",
	"system.syllabus_must_be_all_or_a_syllabus_id_fdf7a4": "syllabus must be \"all\" or a syllabus id",
	"system.from_must_not_be_after_to_49e6f2": "from must not be after to",
	"system.check_not_found_d8745c": "Check not found",
	"system.subject_not_found_20a5c9": "Subject not found",
	"system.p0_is_required_37b0d1": "{p0} is required",
	"system.p0_is_too_long_max_p1_characters_3a1bb2": "{p0} is too long (max {p1} characters)",
	"system.enter_the_program_code_e557a0": "Enter the program code",
	"system.a_program_code_uses_2_to_20_letters_digits_or_hyphens_for_ex_68dac5": "A program code uses 2 to 20 letters, digits or hyphens, for example BSIT.",
	"system.enter_the_program_s_full_name_ca46e4": "Enter the program's full name",
	"system.the_program_s_name_needs_at_least_two_letters_add65b": "The program's name needs at least two letters",
	"system.the_program_name_is_too_long_max_255_characters_e7d4a8": "The program name is too long (max 255 characters)",
	"system.p0_already_exists_1c0019": "{p0} already exists",
	"system.subject_deleted_bd354d": "Subject deleted",
	"system.provide_a_list_of_up_to_20_clos_2e9e3e": "Provide a list of up to 20 CLOs",
	"system.p0_is_invalid_1cc5a9": "{p0} is invalid",
	"system.p0_does_not_belong_to_this_subject_9b84ee": "{p0} does not belong to this subject",
	"system.p0_needs_a_level_p1_2aba59": "{p0} needs a level ({p1})",
	"system.p0_has_an_ega_that_does_not_exist_in_p1_aa5e5d": "{p0} has an EGA that does not exist in {p1}",
	"system.p0_has_a_program_outcome_that_does_not_exist_in_p1_3f7361": "{p0} has a program outcome that does not exist in {p1}",
	"system.p0_title_ed4c90": "{p0} title",
	"system.a_clo_appears_twice_ba6361": "A CLO appears twice",
	"system.mission_needs_1_to_20_items_f09f0c": "Mission needs 1 to 20 items",
	"system.provide_1_to_20_egas_927119": "Provide 1 to 20 EGAs",
	"system.ega_p0_needs_a_unique_number_from_1_to_99_9c30a9": "EGA {p0} needs a unique number from 1 to 99",
	"system.mapping_saved_cc9629": "Mapping saved",
	"system.you_are_not_part_of_this_conversation_f74315": "You are not part of this conversation",
	"system.message_cannot_be_empty_3da76c": "Message cannot be empty",
	"system.message_is_too_long_max_p0_characters_f26dd8": "Message is too long (max {p0} characters)",
	"system.no_administrator_is_available_to_receive_this_message_38532c": "No administrator is available to receive this message",
	"system.new_message_from_p0_p1_5b9ea7": "New message from {p0} {p1}",
	"system.message_sent_9cf1b6": "Message sent",
	"system.messages_marked_as_read_93bb46": "Messages marked as read",
	"system.notifications_marked_as_read_ce3f92": "Notifications marked as read",
	"system.notification_not_found_4ada2b": "Notification not found",
	"system.notification_marked_as_read_37370f": "Notification marked as read",
	"system.provide_a_list_of_up_to_50_program_outcomes_a81c10": "Provide a list of up to 50 program outcomes",
	"system.outcome_p0_needs_a_unique_number_from_1_to_99_a02620": "Outcome {p0} needs a unique number from 1 to 99",
	"system.po_p0_needs_a_short_name_max_120_characters_ffb8e8": "PO {p0} needs a short name (max 120 characters)",
	"system.po_p0_needs_its_statement_max_2000_characters_00b038": "PO {p0} needs its statement (max 2000 characters)",
	"system.po_p0_maps_to_an_ega_that_does_not_exist_in_p1_c8b2f1": "PO {p0} maps to an EGA that does not exist in {p1}",
	"system.upload_a_photo_of_your_cor_jpg_png_or_webp_b5323e": "Upload a photo of your COR (JPG, PNG or WebP).",
	"system.too_many_attempts_try_again_later_d8d0c2": "Too many attempts. Try again later.",
	"system.choose_a_photo_of_your_cor_63bb6c": "Choose a photo of your COR.",
	"system.we_could_not_read_the_student_id_on_your_cor_retake_the_phot_65b820": "We could not read the student ID on your COR. Retake the photo: full page, flat, in good light.",
	"system.use_a_password_of_at_least_8_characters_69cc28": "Use a password of at least 8 characters.",
	"system.scan_your_cor_again_to_continue_408e38": "Scan your COR again to continue.",
	"system.this_student_id_is_already_registered_sign_in_instead_2144d0": "This student ID is already registered. Sign in instead.",
	"system.your_account_is_ready_sign_in_with_your_student_id_and_passw_53505f": "Your account is ready. Sign in with your student ID and password.",
	"system.your_account_was_created_and_is_waiting_for_an_administrator_cda09e": "Your account was created and is waiting for an administrator to verify your COR.",
	"system.students_only_21951b": "Students only",
	"system.no_cor_on_file_9a0b0b": "No COR on file",
	"system.decision_must_be_approve_or_reject_f8dfd0": "decision must be approve or reject",
	"system.no_pending_registration_for_that_student_61356c": "No pending registration for that student",
	"system.student_verified_9e05d9": "Student verified",
	"system.registration_rejected_f73477": "Registration rejected",
	"system.only_pdf_files_are_accepted_938e78": "Only PDF files are accepted",
	"system.title_is_too_long_max_255_characters_7af545": "Title is too long (max 255 characters)",
	"system.course_code_is_too_long_max_50_characters_e90333": "Course code is too long (max 50 characters)",
	"system.new_syllabus_submitted_p0_5b562d": "New syllabus submitted: {p0}",
	"system.p0_p1_submitted_p2_for_review_657f78": "{p0} {p1} submitted {p2} for review.",
	"system.syllabus_uploaded_860a4e": "Syllabus uploaded",
	"system.only_administrators_can_change_a_syllabus_status_b305ae": "Only administrators can change a syllabus status",
	"system.invalid_status_28b5a7": "Invalid status",
	"system.administrators_cannot_edit_syllabus_content_6ddaca": "Administrators cannot edit syllabus content",
	"system.reviewer_comment_p0_0caf52": "Reviewer comment: {p0}",
	"system.syllabus_updated_904e23": "Syllabus updated",
	"system.p0_p1_submitted_p2_uploaded_file_for_review_445d4a": "{p0} {p1} submitted {p2} (uploaded file) for review.",
	"system.syllabus_updated_during_review_p0_p1_9c07d5": "Syllabus updated during review: {p0} ({p1})",
	"system.syllabus_resubmitted_p0_p1_fb861c": "Syllabus resubmitted: {p0} ({p1})",
	"system.p0_p1_saved_a_new_version_ee2612": "{p0} {p1} saved a new version.",
	"system.only_draft_syllabi_can_be_deleted_by_faculty_832244": "Only draft syllabi can be deleted by faculty.",
	"system.this_syllabus_changed_or_was_removed_refresh_your_list_befor_71c4b3": "This syllabus changed or was removed. Refresh your list before deleting.",
	"system.syllabus_deleted_0c0a2d": "Syllabus deleted",
	"system.sections_must_be_an_object_with_at_least_one_section_016336": "sections must be an object with at least one section",
	"system.unknown_section_p0_150c8c": "Unknown section \"{p0}\"",
	"system.section_p0_must_be_p1_c0c5a6": "Section \"{p0}\" must be {p1}",
	"system.a_list_e3206e": "a list",
	"system.an_object_6d24ab": "an object",
	"system.meta_p0_must_be_text_e0c2cb": "meta.{p0} must be text",
	"system.meta_courseid_must_be_a_course_id_70c04c": "meta.courseId must be a course id",
	"system.each_plan_row_needs_an_ilos_list_c15fb3": "Each plan row needs an ilos list",
	"system.ilo_tags_must_look_like_clo_id_ega_no_or_po_no_929dd3": "ILO tags must look like clo:<id>, ega:<no> or po:<no>",
	"system.that_course_does_not_exist_9b4df4": "That course does not exist",
	"system.only_the_owner_can_edit_syllabus_content_ceacae": "Only the owner can edit syllabus content",
	"system.this_syllabus_is_too_large_to_save_limit_p0_kb_ce0b6e": "This syllabus is too large to save (limit {p0} KB)",
	"system.version_not_found_8ae7d0": "Version not found",
	"system.only_the_owner_can_submit_a_syllabus_78da25": "Only the owner can submit a syllabus",
	"system.choose_a_course_before_submitting_2d67db": "Choose a course before submitting",
	"system.this_syllabus_is_too_large_to_submit_limit_p0_kb_b272fc": "This syllabus is too large to submit (limit {p0} KB)",
	"system.p0_submitted_p1_for_review_dfad43": "{p0} submitted {p1} for review.",
	"system.p0_saved_a_new_version_4242a0": "{p0} saved a new version.",
	"system.enter_a_first_and_last_name_each_between_1_and_100_character_96bc58": "Enter a first and last name, each between 1 and 100 characters.",
	"system.profile_editing_is_available_to_faculty_and_administrators_0e222d": "Profile editing is available to faculty and administrators.",
	"system.could_not_save_your_name_please_try_again_7c17e6": "Could not save your name. Please try again.",
	"system.language_preferences_are_available_to_faculty_and_administra_45e04c": "Language preferences are available to faculty and administrators.",
	"system.could_not_save_your_language_preference_please_try_again_479b33": "Could not save your language preference. Please try again.",
	"system.first_name_last_name_and_email_are_required_5bef18": "first_name, last_name and email are required",
	"system.invalid_email_address_9e4ee6": "Invalid email address",
	"system.use_an_institutional_email_address_ending_in_9e7715": "Use an institutional email address ending in @",
	"system.invalid_role_110637": "Invalid role",
	"system.a_user_with_this_email_is_already_registered_c4ac56": "A user with this email is already registered",
	"system.user_not_found_01eb94": "User not found",
	"system.you_cannot_reset_your_own_password_here_f82f48": "You cannot reset your own password here.",
	"system.you_are_sending_too_often_try_again_in_a9f2af": "You are sending too often. Try again in ",
	"system.this_account_signs_in_with_a_student_id_not_an_email_address_1adadc": "This account signs in with a student ID, not an email address.",
	"system.only_faculty_can_be_assigned_programs_and_courses_b37245": "Only faculty can be assigned programs and courses",
	"system.your_program_and_course_assignments_were_updated_99f59c": "Your program and course assignments were updated",
	"system.you_can_now_create_syllabi_for_p0_subject_p1_6151c9": "You can now create syllabi for {p0} subject{p1}.",
	"system.no_program_or_subject_is_assigned_to_you_right_now_ask_an_ad_3c3272": "No program or subject is assigned to you right now. Ask an administrator.",
	"system.photo_sync_is_available_to_faculty_and_administrators_9274ed": "Photo sync is available to faculty and administrators.",
	"system.could_not_sync_your_google_photo_please_try_again_766713": "Could not sync your Google photo. Please try again.",
	"system.image_is_too_large_the_maximum_size_is_2_mb_74f7ce": "Image is too large. The maximum size is 2 MB.",
	"system.upload_the_image_in_the_avatar_field_one_file_only_743788": "Upload the image in the \"avatar\" field, one file only.",
	"system.the_upload_could_not_be_processed_bd0108": "The upload could not be processed.",
	"system.no_image_uploaded_choose_a_jpeg_png_or_webp_file_e49009": "No image uploaded. Choose a JPEG, PNG or WebP file.",
	"system.unsupported_file_use_a_jpeg_png_or_webp_image_2cbb3b": "Unsupported file. Use a JPEG, PNG or WebP image.",
	"system.could_not_save_your_photo_please_try_again_025939": "Could not save your photo. Please try again.",
	"system.could_not_remove_your_photo_please_try_again_c15b90": "Could not remove your photo. Please try again.",
	"system.could_not_load_that_photo_d8550e": "Could not load that photo.",
	"system.could_not_remove_that_photo_please_try_again_36e6fd": "Could not remove that photo. Please try again.",
	"system.you_cannot_remove_your_own_account_bd66f1": "You cannot remove your own account",
	"system.user_deleted_c7134d": "User deleted",
	"system.outcome_6c0d09": "Outcome ",
	"system.computer_programming_2_982f6f": "Computer Programming 2",
	"system.outcome_1_aa5458": "Outcome 1",
	"system.outcome_2_e383b4": "Outcome 2",
	"system.review_b0b704": "Review ",
	"system.the_ai_provider_took_too_long_c7b397": "The AI provider took too long.",
	"system.no_ai_provider_is_configured_00ebb2": "No AI provider is configured.",
	"system.the_ai_returned_nothing_usable_8ebcb9": "The AI returned nothing usable.",
	"system.unknown_compliance_check_70fd9f": "Unknown compliance check \"",
	"system.in_rule_c5c19c": "\" in rule ",
	"system.this_syllabus_does_not_follow_the_form_yet_f5f6b7": "This syllabus does not follow the form yet: ",
	"system.and_faa75a": "(and ",
	"system.more_02dbfc": "more).",
	"system.the_uploaded_file_could_not_be_found_on_the_server_or_it_is__72ee5a": "The uploaded file could not be found on the server, or it is empty.",
	"system.the_file_is_not_a_complete_pdf_document_the_pdf_header_or_en_087d98": "The file is not a complete PDF document (the PDF header or end marker is missing). Ask the faculty member to upload it again.",
	"system.the_pdf_is_password_protected_so_a_reviewer_cannot_open_it_2b4816": "The PDF is password protected, so a reviewer cannot open it.",
	"system.the_course_code_and_title_were_not_entered_with_the_upload_669725": "The course code and title were not entered with the upload.",
	"system.no_program_is_linked_to_this_upload_c74cd6": "No program is linked to this upload.",
	"system.the_pdf_has_only_one_page_a_syllabus_in_the_university_form__0d17bb": "The PDF has only one page. A syllabus in the university form runs to several pages, so this file may be incomplete.",
	"system.matching_to_the_template_is_not_done_yet_05bb3c": "Matching to the template is not done yet",
	"system.verify_your_google_workspace_account_to_sync_its_photo_1358d8": "Verify your Google Workspace account to sync its photo.",
	"system.google_photo_sync_is_not_configured_on_the_server_05b1d3": "Google photo sync is not configured on the server.",
	"system.google_account_verification_failed_please_try_again_f198d6": "Google account verification failed. Please try again.",
	"system.choose_the_google_workspace_account_that_matches_your_signed_b30c33": "Choose the Google Workspace account that matches your signed-in email.",
	"system.this_google_account_has_no_available_profile_photo_01ce68": "This Google account has no available profile photo.",
	"system.the_google_profile_photo_url_is_not_supported_a7a1d4": "The Google profile photo URL is not supported.",
	"system.photo_unavailable_9b5934": "Photo unavailable",
	"system.photo_too_large_865f37": "Photo too large",
	"system.could_not_import_your_google_photo_your_current_photo_has_be_7f02df": "Could not import your Google photo. Your current photo has been kept.",
	"system.google_photo_access_is_required_0a98bc": "Google photo access is required.",
	"system.google_photo_access_expired_or_could_not_be_verified_please__20e355": "Google photo access expired or could not be verified. Please try again.",
	"system.google_photo_access_expired_or_belongs_to_another_applicatio_e3d6fc": "Google photo access expired or belongs to another application.",
	"system.profile_unavailable_a71ecd": "Profile unavailable",
	"system.could_not_read_your_google_profile_your_current_photo_has_be_f4cb59": "Could not read your Google profile. Your current photo has been kept.",
	"system.program_not_found_d00252": "Program not found",
	"system.that_name_is_already_used_by_p0_c61bec": "That name is already used by {p0}.",
	"system.that_program_was_just_created_try_again_a424d0": "That program was just created. Try again.",
	"system.write_a_comment_first_d1d999": "Write a comment first.",
	"system.a_comment_can_be_at_most_p0_characters_999ad3": "A comment can be at most {p0} characters.",
	"system.say_why_the_syllabus_is_rejected_at_least_5_characters_90f81a": "Say why the syllabus is rejected (at least 5 characters).",
	"system.say_what_needs_to_change_at_least_5_characters_9a51db": "Say what needs to change (at least 5 characters).",
	"system.the_note_can_be_at_most_p0_characters_81a137": "The note can be at most {p0} characters.",
	"system.shared_with_count_other_program_subject_suffix_subjects_a_ch_5beb94": "Shared with {count} other {program} subject{suffix}: {subjects}. A change here applies to all of them.",
	"system.only_course_uses_these_in_program_for_now_91f536": "Only {course} uses these in {program} for now.",
	"system.the_vision_bfd77e": "the vision",
	"system.the_mission_d1ed71": "the mission",
	"system.the_program_graduate_attributes_egas_e29d3c": "the {program} graduate attributes (EGAs)",
	"system.the_program_program_outcomes_e9730b": "the {program} program outcomes",
	"system.the_learning_outcomes_of_course_4eca34": "the learning outcomes of {course}",
	"system.approved_course_5e4f0e": "Approved: {course}",
	"system.returned_for_revision_course_7f8d1a": "Returned for revision: {course}",
	"system.rejected_course_f88b82": "Rejected: {course}",
	"system.title_3c6de1": "title",
	"system.curriculum_4a130a": "curriculum",
	"system.file_971c41": "file",
	"system.count_weeks_rows_rows_643e3d": "{count} weeks · {rows} rows",
	"system.count_week_rows_row_0c3435": "{count} week · {rows} row",
	"system.count_week_rows_rows_a992ff": "{count} week · {rows} rows",
	"system.count_weeks_rows_row_cbbeef": "{count} weeks · {rows} row",
	"system.count_submission_is_3fc1cc": "{count} submission is",
	"system.count_submissions_are_459d69": "{count} submissions are",
	"system.it_appears_1befb1": "it appears",
	"system.they_appear_061e31": "they appear",
	"system.check_not_found_3de409": "Check not found.",
	"system.admin_access_required_737b16": "Admin access required",
	"system.not_available_for_student_accounts_0203b3": "Not available for student accounts",
	"system.choose_your_own_password_before_you_continue_5bef53": "Choose your own password before you continue.",
	"system.message_count_more_like_this_c310da": "{message} {count} more like this.",
	"system.course_course_is_not_assigned_to_you_fbe906": "Course {course} is not assigned to you.",
	"system.field_is_required_f9caf4": "{field} is required.",
	"system.password_must_be_at_least_8_characters_17ca64": "Password must be at least 8 characters.",
	"system.could_not_load_your_account_please_try_again_707ae0": "Could not load your account. Please try again.",
	"system.the_password_must_be_at_least_count_characters_b23fc6": "The password must be at least {count} characters.",
	"system.the_password_must_be_at_most_72_characters_acefd4": "The password must be at most 72 characters.",
	"system.the_password_needs_at_least_one_letter_and_one_number_c6a439": "The password needs at least one letter and one number.",
	"system.the_password_must_not_be_your_email_address_41a5a6": "The password must not be your email address.",
	"system.status_syllabi_can_t_be_edited_a73120": "{status} syllabi can't be edited",
	"system.it_6c5522": "it",
	"system.them_98910a": "them",
	"system.language_change_was_not_saved_your_previous_language_has_bee_bb23ef": "Language change was not saved. Your previous language has been restored.",
	"system.form_section_510ca0": "FORM SECTION",
	"system.the_version_you_submitted_10446c": "the version you submitted",
	"system.the_next_version_eeb634": "the next version",
	"system.course_information_63dce9": "Course information",
	"system.course_description_17fff9": "Course description",
	"system.learning_plan_2378ac": "Learning plan",
	"system.course_requirements_4f2446": "Course requirements",
	"system.grading_system_51e556": "Grading system",
	"system.count_word_494d2c": "{count} word",
	"system.count_words_c08299": "{count} words",
	"system.count_week_8ba3e1": "{count} week",
	"system.count_weeks_cc8d5b": "{count} weeks",
	"system.complete_this_field_6ecc23": "Complete this field.",
	"system.enter_a_valid_email_address_2e09ed": "Enter a valid email address.",
	"system.use_the_requested_format_d01605": "Use the requested format.",
	"system.use_at_least_count_characters_cba05a": "Use at least {count} characters.",
	"system.use_no_more_than_count_characters_59bff2": "Use no more than {count} characters.",
	"system.enter_a_value_of_at_least_value_c17895": "Enter a value of at least {value}.",
	"system.enter_a_value_no_greater_than_value_8ae6cd": "Enter a value no greater than {value}.",
	"system.enter_a_valid_value_b9dff2": "Enter a valid value.",
	"system.count_program_cb3274": "{count} program",
	"system.count_programs_a766dc": "{count} programs",
	"system.count_subject_47d205": "{count} subject",
	"system.count_subjects_f103fc": "{count} subjects",
	"system.unknown_faculty_e29830": "unknown faculty",
	"system.percent_56b249": "percent",
	"system.rows_52d0b3": "Rows",
	"system.row_9bf7a8": "Row",
	"system.this_subject_is_not_assigned_to_you_ask_an_administrator_1b9590": "This subject is not assigned to you. Ask an administrator.",
	"system.this_was_changed_by_someone_else_reload_to_see_the_latest_bf2233": "This was changed by someone else. Reload to see the latest.",
	"system.nothing_has_changed_since_the_version_you_submitted_make_the_21c5c1": "Nothing has changed since the version you submitted. Make the changes the reviewer asked for, then submit again.",
	"system.tell_the_reviewer_what_you_changed_at_least_a_sentence_befor_31523c": "Tell the reviewer what you changed (at least a sentence) before you submit again.",
	"system.this_syllabus_was_submitted_and_is_locked_it_can_be_edited_a_84b2a2": "This syllabus was submitted and is locked. It can be edited again only if the administrator returns it for revision.",
	"system.this_syllabus_is_status_and_can_no_longer_be_edited_4efd51": "This syllabus is {status} and can no longer be edited",
	"system.the_administrator_has_not_finished_setting_up_this_subject_y_70e58e": "The administrator has not finished setting up this subject yet: {gaps} is missing. Please contact them, then try again.",
	"system.the_administrator_has_not_finished_setting_up_this_subject_y_8ca34f": "The administrator has not finished setting up this subject yet: {gaps} are missing. Please contact them, then try again.",
	"system.kind_number_is_used_by_subjects_338379": "{kind} {number} is used by {subjects}",
	"system.remove_those_tags_first_df7fe9": "Remove those tags first.",
	"system.no_ai_client_is_configured_d8e253": "No AI client is configured.",
	"system.the_ai_reply_was_not_valid_json_98f9a5": "The AI reply was not valid JSON.",
	"system.the_ai_reply_had_no_list_of_recommendations_018437": "The AI reply had no list of recommendations.",
	"system.faculty_compliance_report_1b5c9b": "FACULTY COMPLIANCE REPORT",
	"system.generated_8eefdd": "Generated",
	"system.compliance_rate_0c1dcd": "Compliance Rate",
	"system.faculty_breakdown_c2a0a2": "FACULTY BREAKDOWN",
	"system.total_total_approved_approved_rate_compliance_209760": "{total} total, {approved} approved, {rate}% compliance"
};
const extraTl = {
	"system.dashboard_d87f47": "Pangkalahatang Tanaw",
	"system.syllabus_builder_a96252": "Tagabuo ng Silabus",
	"system.ai_checker_afc99a": "Tagasuri ng AI",
	"system.repository_312386": "Imbakan",
	"system.analytics_25bc96": "Estadistika",
	"system.academics_administrator_a34264": "Administrador sa Akademiko",
	"system.full_access_5e4017": "Buong access",
	"system.create_submit_ec1174": "Gumawa at magpasa",
	"system.my_submissions_282583": "Aking mga Naipasa",
	"system.total_uploaded_dd48c1": "Kabuuang na-upload",
	"system.accepted_syllabi_599e98": "Mga aprubadong silabus",
	"system.pending_review_9aab7f": "Naghihintay ng Pagsusuri",
	"system.awaiting_decision_c3edf4": "Naghihintay ng pasya",
	"system.needs_changes_98f291": "Kailangang baguhin",
	"system.ai_compliance_score_296f1c": "Marka sa Pagsunod gamit ang AI",
	"system.your_compliance_rate_cdd401": "Antas ng iyong pagsunod",
	"system.total_courses_7a0d46": "Kabuuang Kurso",
	"system.all_syllabi_5accd3": "Lahat ng silabus",
	"system.submitted_syllabi_00ae9f": "Mga Naipasang Silabus",
	"system.awaiting_review_5a5a12": "Naghihintay ng pagsusuri",
	"system.under_review_7e3e17": "Sinusuri",
	"system.institutional_average_c9c5db": "Karaniwan sa institusyon",
	"system.view_report_7398c9": "Tingnan ang ulat",
	"system.view_analytics_7ad995": "Tingnan ang estadistika",
	"system.average_15f86c": "Karaniwan",
	"system.complete_1f5a1a": "Kumpleto",
	"system.references_5d20d0": "Mga Sanggunian",
	"system.decision_7f59a1": "Pasya",
	"system.comments_fce06e": "Mga komento",
	"system.rejected_27eeb7": "Tinanggihan",
	"system.returned_870770": "Ibinalik",
	"system.approve_syllabus_3e6f34": "Aprubahan ang silabus",
	"system.locks_it_from_further_edits_96d0e7": "Hindi na ito mababago",
	"system.approve_this_syllabus_it_will_be_locked_from_further_edits_ca25e9": "Aprubahan ang silabus na ito? Hindi na ito mababago pagkatapos.",
	"system.return_for_revision_44d630": "Ibalik para baguhin",
	"system.the_faculty_member_edits_and_resubmits_1640a9": "Babaguhin at ipapasa muli ng guro",
	"system.return_this_syllabus_to_the_faculty_member_for_revision_76a8c8": "Ibalik ang silabus na ito sa guro upang baguhin?",
	"system.reject_2b03b5": "Tanggihan",
	"system.closes_this_submission_5bbbbf": "Isinasara ang naipasang ito",
	"system.reject_this_syllabus_the_faculty_member_is_told_why_dd26e6": "Tanggihan ang silabus na ito? Ipaaalam sa guro ang dahilan.",
	"system.choose_a_decision_6a8df6": "Pumili ng pasya.",
	"system.say_why_it_is_rejected_at_least_count_characters_d5c0cd": "Sabihin kung bakit ito tinatanggihan (hindi bababa sa {count} character).",
	"system.say_what_needs_to_change_at_least_count_characters_798146": "Sabihin kung ano ang kailangang baguhin (hindi bababa sa {count} character).",
	"system.comment_153d7a": "Komento",
	"system.revision_request_f081be": "Kahilingan sa rebisyon",
	"system.rejection_6f178e": "Pagtanggi",
	"system.approval_8cc047": "Pag-apruba",
	"system.returned_for_revision_871cf5": "Ibinalik para baguhin",
	"system.course_code_e5c57b": "code ng kurso",
	"system.syllabus_content_f0d5ce": "nilalaman ng silabus",
	"system.this_syllabus_was_submitted_as_an_uploaded_file_so_there_is__9efe78": "Naipasa ang silabus na ito bilang file kaya walang form na maipapakita. Buksan ang file sa ibaba.",
	"system.this_syllabus_has_no_builder_form_and_no_uploaded_file_store_6fa312": "Walang naka-save na form o na-upload na file para sa silabus na ito kaya walang maipapakita rito.",
	"system.untitled_syllabus_9ad551": "Silabus na walang pamagat",
	"system.you_905cb3": "Ikaw",
	"system.someone_35bb09": "May isang user",
	"system.today_24345a": "Ngayon",
	"system.yesterday_da2483": "Kahapon",
	"system.a_syllabus_c19cde": "isang silabus",
	"system.approved_c9560d": "nag-apruba ng",
	"system.returned_for_revision_1c5609": "nagbalik para baguhin ang",
	"system.rejected_1f087a": "tumanggi sa",
	"system.submitted_fda437": "nagpasa ng",
	"system.uploaded_f40369": "nag-upload ng",
	"system.updated_13a189": "nag-update ng",
	"system.deleted_b639f5": "nagbura ng",
	"system.made_a_change_to_dfb4d4": "nagbago ng",
	"system.at_least_8_characters_with_a_letter_and_a_number_22b303": "Hindi bababa sa 8 character, na may letra at numero.",
	"system.invalid_email_or_password_01126f": "Mali ang email o password.",
	"system.google_sign_in_failed_c0aae7": "Hindi nakapag-sign in gamit ang Google.",
	"system.sign_in_with_google_4a0b72": "Mag-sign in gamit ang Google",
	"system.could_not_load_google_sign_in_17e7fa": "Hindi ma-load ang Google Sign-In.",
	"system.google_sign_in_is_not_configured_missing_vite_google_client__d9cfd5": "Hindi naka-configure ang Google sign-in. Makipag-ugnayan sa administrador.",
	"system.google_photo_access_was_not_granted_please_try_again_fe9573": "Hindi pinayagan ang access sa larawan sa Google. Subukan muli.",
	"system.google_photo_sync_was_cancelled_your_current_photo_has_been__a60095": "Kinansela ang pag-sync ng larawan sa Google. Pinanatili ang kasalukuyan mong larawan.",
	"system.could_not_open_google_photo_sync_allow_popups_for_this_site__0ac9f9": "Hindi mabuksan ang pag-sync ng larawan sa Google. Payagan ang mga popup para sa site at subukan muli.",
	"system.could_not_start_google_photo_sync_please_try_again_15d1de": "Hindi masimulan ang pag-sync ng larawan sa Google. Subukan muli.",
	"system.google_photo_sync_is_not_configured_contact_your_administrat_07c7e0": "Hindi naka-configure ang pag-sync ng larawan sa Google. Makipag-ugnayan sa administrador.",
	"system.google_photo_sync_is_still_loading_please_try_again_3a7907": "Nilo-load pa ang pag-sync ng larawan sa Google. Subukan muli.",
	"system.profile_changes_saved_a4f461": "Na-save ang mga pagbabago sa profile.",
	"system.google_workspace_photo_synced_bbc91c": "Na-sync ang larawan sa Google Workspace.",
	"system.cannot_reach_the_server_check_that_the_api_is_running_and_tr_d193c0": "Hindi makakonekta sa server. Tiyaking tumatakbo ang API at subukan muli.",
	"system.choose_a_jpeg_png_or_webp_image_7724fb": "Pumili ng larawang JPEG, PNG o WebP.",
	"system.that_image_is_over_5_mb_choose_a_smaller_one_ba2698": "Lampas sa 5 MB ang larawan. Pumili ng mas maliit.",
	"system.that_file_could_not_be_read_as_an_image_644cb3": "Hindi mabasa ang file bilang larawan.",
	"system.could_not_process_that_image_cdb958": "Hindi maproseso ang larawang iyon.",
	"system.could_not_load_administrator_settings_please_try_again_fd072a": "Hindi ma-load ang mga setting ng administrador. Subukan muli.",
	"system.could_not_save_administrator_settings_please_try_again_0ca0c5": "Hindi ma-save ang mga setting ng administrador. Subukan muli.",
	"system.enter_valid_administrator_settings_66fbc0": "Ilagay ang wastong mga setting ng administrador.",
	"system.choose_english_or_tagalog_1fe6a7": "Pumili ng English o Tagalog.",
	"system.course_information_5f740d": "Impormasyon ng Kurso",
	"system.learning_outcomes_4f09ca": "Mga Kinalabasan ng Pagkatuto",
	"system.learning_plan_80b712": "Plano ng Pagkatuto",
	"system.course_requirements_212b44": "Mga Kinakailangan sa Kurso",
	"system.grading_system_d227f8": "Sistema ng Pagmamarka",
	"system.review_check_0b1d47": "Suriin at Tiyakin",
	"system.form_804463": "Form",
	"system.identify_the_course_school_year_and_college_are_filled_in_fo_130701": "Tukuyin ang kurso. Awtomatikong nakalagay ang taong panuruan at kolehiyo.",
	"system.the_institution_s_vision_mission_graduate_attributes_and_pro_8ba434": "Bisyon, misyon, mga katangian ng nagtapos at kinalabasan ng programa ng institusyon, kasama ang mga kinalabasan ng pagkatuto ng kurso na kaugnay ng mga ito.",
	"system.one_row_per_week_or_week_range_tag_every_ilo_with_the_outcom_a50cb4": "Isang hanay bawat linggo o saklaw ng linggo. Iugnay ang bawat ILO sa mga kinalabasang sinusuportahan nito.",
	"system.what_students_must_complete_suggestions_come_from_your_asses_a4f86c": "Mga kailangang tapusin ng estudyante. Batay sa iyong mga gawain sa pagtataya ang mga mungkahi.",
	"system.group_references_the_way_the_form_does_older_sources_are_mar_60031e": "Pangkatin ang mga sanggunian ayon sa form. Minamarkahan ang mas matatandang sanggunian.",
	"system.components_must_total_100_the_formulas_follow_from_them_and__68f70a": "Dapat 100% ang kabuuan ng mga bahagi. Nakabatay rito at sa mga hanay ng pagsusulit ang mga formula.",
	"system.check_the_finished_form_against_the_template_and_read_it_thr_0a0bd0": "Ihambing sa template at basahin ang natapos na form. Awtomatikong inilalagay ang mga pangalan ng nagpapatibay kapag sinuri at inaprubahan ito.",
	"system.weekly_topics_f1b506": "Mga Paksa sa Bawat Linggo",
	"system.assessment_plan_130e76": "Plano ng Pagtataya",
	"system.policies_8d6118": "Mga Patakaran",
	"system.introductory_820724": "Panimula",
	"system.enabling_ab6c4d": "Paglinang",
	"system.demonstrating_b9a3fc": "Pagpapamalas",
	"system.integration_of_values_0fb072": "Pagsasama ng mga Pagpapahalaga",
	"system.books_4a7fdd": "Mga Aklat",
	"system.internet_programming_5c3b8a": "Internet Programming",
	"system.internet_references_a92d58": "Mga Sanggunian sa Internet",
	"system.electronics_89f1eb": "Elektroniko",
	"system.undo_39fc72": "Ibalik",
	"system.save_as_new_version_95073f": "I-save bilang bagong bersiyon",
	"system.submit_2dacf6": "Ipasa",
	"system.auto_save_enabled_914b94": "Naka-enable ang awtomatikong pag-save",
	"system.check_your_connection_7bc817": "Suriin ang iyong koneksiyon",
	"system.saving_ae7e88": "Nagse-save...",
	"system.save_outcomes_4bfb7f": "I-save ang mga kinalabasan",
	"system.school_wide_all_programs_a4dd79": "Buong paaralan · lahat ng programa",
	"system.leave_without_saving_your_assignment_changes_45bdf1": "Umalis nang hindi sine-save ang iyong mga pagbabago sa pagtatalaga?",
	"system.close_without_saving_your_changes_94cf16": "Isara nang hindi sine-save ang iyong mga pagbabago?",
	"system.edit_this_syllabus_saved_as_a_new_version_d7950d": "Baguhin ang silabus na ito (ise-save bilang bagong bersiyon)",
	"system.no_clos_yet_add_them_in_step_2_f4fa53": "Wala pang CLO. Idagdag ang mga ito sa hakbang 2.",
	"system.no_match_48ee63": "Walang tugma.",
	"system.this_program_4e3f0e": "programang ito",
	"system.no_program_chosen_7421d4": "walang napiling programa",
	"system.your_latest_changes_could_not_be_saved_so_they_were_not_chec_8fb98e": "Hindi na-save ang pinakabago mong pagbabago kaya hindi ito nasuri.",
	"system.meets_the_standard_ab6a46": "Naaayon sa pamantayan",
	"system.below_the_pass_line_1e4f08": "Mas mababa sa pasadong marka",
	"system.not_scored_fcaa08": "Walang marka",
	"system.rule_based_check_5980c6": "Pagsusuri batay sa mga tuntunin",
	"system.ai_assisted_check_380670": "Pagsusuri sa tulong ng AI",
	"system.ai_unavailable_e98b69": "Hindi magagamit ang AI",
	"system.the_rule_check_is_done_recommendations_are_still_being_writt_1fa552": "Tapos na ang pagsusuri ng mga tuntunin. Ginagawa pa ang mga rekomendasyon.",
	"system.ai_suggestions_are_not_available_right_now_so_these_recommen_e46f90": "Hindi magagamit ang mga mungkahi ng AI sa ngayon, kaya batay sa mga tuntunin ang mga rekomendasyong ito.",
	"system.not_enough_written_yet_to_give_a_score_fill_in_more_of_the_f_886164": "Kulang pa ang nakasulat upang mabigyan ng marka. Punan pa ang form.",
	"system.check_4b5e84": "Suriin",
	"system.high_b1a595": "Mataas",
	"system.medium_d40496": "Katamtaman",
	"system.low_a12494": "Mababa",
	"system.excellent_1aafbf": "Napakahusay",
	"system.good_61dedc": "Mahusay",
	"system.needs_improvement_379094": "Kailangang Pagbutihin",
	"system.poor_4e0fa4": "Mababa",
	"system.student_id_76b822": "ID ng estudyante",
	"system.name_709a23": "Pangalan",
	"system.year_level_7b07b7": "Antas ng taon",
	"system.section_f2c6b5": "Seksyon",
	"system.term_770bce": "Termino",
	"system.your_compliance_score_ae802b": "Iyong marka sa pagsunod",
	"system.pending_reviews_512845": "Mga naghihintay na pagsusuri",
	"system.needs_attention_a12672": "Kailangang ayusin",
	"system.tip_d19cec": "Mungkahi",
	"system.use_the_compliance_check_in_step_7_of_the_builder_to_improve_79e065": "Gamitin ang pagsusuri sa pagsunod sa hakbang 7 ng tagabuo upang mapataas ang marka bago magpasa.",
	"system.bsit_has_the_highest_compliance_70e858": "Pinakamataas ang pagsunod ng BSIT",
	"system.93_average_compliance_maintain_current_review_cadence_0dc1ca": "93% ang karaniwang pagsunod; panatilihin ang iskedyul ng pagsusuri.",
	"system.assessment_alignment_needs_attention_4be3e3": "Kailangang ayusin ang pagtutugma ng pagtataya",
	"system.21_of_reviewed_syllabi_have_incomplete_co_to_assessment_mapp_4eb42f": "Hindi kumpleto ang pagmamapa ng CO sa pagtataya sa 21% ng mga nasuring silabus.",
	"system.references_should_be_refreshed_fa7645": "Kailangang i-update ang mga sanggunian",
	"system.32_of_references_are_older_than_ten_years_across_active_syll_dd9aa3": "Higit sa sampung taong gulang ang 32% ng mga sanggunian sa mga aktibong silabus.",
	"system.approval_backlog_is_manageable_8c9733": "Kayang tugunan ang mga naghihintay na pag-apruba",
	"system.18_syllabi_remain_under_review_6_are_already_overdue_2d78eb": "May 18 silabus pang sinusuri; lampas na sa takdang petsa ang 6.",
	"system.count_average_across_total_syllabi_121b42": "{count}% ang karaniwang marka sa {total} silabus.",
	"system.count_syllabi_currently_under_review_6f4631": "Kasalukuyang sinusuri ang {count} silabus.",
	"system.count_syllabi_returned_or_rejected_c37b18": "May {count} silabus na ibinalik o tinanggihan.",
	"system.step_number_title_dd7939": "Hakbang {number}: {title}",
	"system.finish_step_number_first_title_bb71fd": "Tapusin muna ang hakbang {number}: {title}.",
	"system.week_week_deleted_5f67b4": "Nabura ang linggo {week}.",
	"system.not_saved_message_be8039": "Hindi na-save. {message}",
	"system.auto_save_enabled_saved_time_da4e35": "Naka-enable ang awtomatikong pag-save · na-save noong {time}",
	"system.count_warning_remains_f2ff3f": "May {count} babala pang natitira",
	"system.count_warnings_remain_81d33c": "May {count} babala pang natitira",
	"system.count_finding_03de7f": "{count} resulta",
	"system.count_findings_215eaf": "{count} resulta",
	"system.count_check_e03232": "{count} pagsusuri",
	"system.count_checks_00f478": "{count} pagsusuri",
	"system.showing_range_709ec4": "Ipinapakita ang {range}",
	"system.showing_checks_range_2a0a4c": "Ipinapakita ang mga pagsusuri {range}",
	"system.since_date_86770b": "Mula {date}",
	"system.until_date_5a3981": "Hanggang {date}",
	"system.count_problem_stops_this_syllabus_from_being_submitted_0d5c67": "May {count} problemang pumipigil sa pagpasa ng silabus na ito.",
	"system.count_problems_stop_this_syllabus_from_being_submitted_d9dedf": "May {count} problemang pumipigil sa pagpasa ng silabus na ito.",
	"system.meets_the_standard_pass_line_score_4f78a8": "Naaayon sa pamantayan (pasadong marka: {score}%).",
	"system.below_the_pass_line_of_score_you_can_still_submit_the_review_7ef4e7": "Mas mababa sa pasadong markang {score}%. Maaari ka pa ring magpasa; makikita ng tagasuri ang markang ito.",
	"system.choose_a_program_16a93a": "Pumili ng programa.",
	"system.choose_a_subject_e961b3": "Pumili ng asignatura.",
	"system.pre_requisite_is_empty_ad5dc0": "Walang nakalagay na paunang kailangan.",
	"system.enter_lecture_and_laboratory_units_80dd0a": "Ilagay ang mga yunit sa lektura at laboratoryo.",
	"system.add_at_least_one_description_paragraph_4b3384": "Magdagdag ng kahit isang talata ng paglalarawan.",
	"system.the_vision_has_not_been_added_yet_please_ask_your_administra_6a29cf": "Hindi pa naidaragdag ang bisyon. Makipag-ugnayan sa administrador.",
	"system.the_mission_has_not_been_added_yet_please_ask_your_administr_f2c71b": "Hindi pa naidaragdag ang misyon. Makipag-ugnayan sa administrador.",
	"system.no_graduate_attributes_egas_have_been_added_for_program_yet__3fb769": "Wala pang naidagdag na mga katangian ng nagtapos (EGA) para sa {program}. Makipag-ugnayan sa administrador.",
	"system.no_program_outcomes_have_been_added_for_program_yet_please_a_06a2b3": "Wala pang naidagdag na mga kinalabasan ng programa para sa {program}. Makipag-ugnayan sa administrador.",
	"system.no_learning_outcomes_have_been_added_for_subject_yet_please__ecfcd8": "Wala pang naidagdag na mga kinalabasan ng pagkatuto para sa {subject}. Makipag-ugnayan sa administrador.",
	"system.clo_number_has_no_statement_yet_please_ask_your_administrato_204ede": "Wala pang pahayag ang CLO {number}. Makipag-ugnayan sa administrador.",
	"system.clo_number_has_no_graduate_attribute_ega_tag_yet_please_ask__874b3a": "Wala pang kaugnay na katangian ng nagtapos (EGA) ang CLO {number}. Makipag-ugnayan sa administrador.",
	"system.clo_number_has_no_program_outcome_tag_yet_please_ask_your_ad_7fab3e": "Wala pang kaugnay na kinalabasan ng programa ang CLO {number}. Makipag-ugnayan sa administrador.",
	"system.add_at_least_one_week_ea1bba": "Magdagdag ng kahit isang linggo.",
	"system.add_at_least_one_lesson_with_a_learning_outcome_ilo_45d531": "Magdagdag ng kahit isang aralin na may kinalabasan ng pagkatuto (ILO).",
	"system.a_row_has_no_week_enter_the_week_or_delete_the_row_325fdf": "May hanay na walang linggo. Ilagay ang linggo, o burahin ang hanay.",
	"system.week_week_has_no_learning_outcome_ilo_3b6183": "Walang kinalabasan ng pagkatuto (ILO) ang linggo {week}.",
	"system.week_week_ilo_ilo_has_no_clo_tag_dc23a1": "Walang kaugnay na CLO ang ILO {ilo} ng linggo {week}.",
	"system.week_week_ilo_ilo_is_tagged_but_has_no_text_2d9bc6": "May kaugnay na kinalabasan ang ILO {ilo} ng linggo {week} ngunit wala itong teksto.",
	"system.week_week_ilo_ilo_has_a_tag_that_no_longer_resolves_tag_0dc8d7": "May ugnayang hindi na matukoy ang ILO {ilo} ng linggo {week}: {tag}",
	"system.clo_number_is_not_covered_by_any_ilo_yet_234f27": "Hindi pa nasasaklaw ng anumang ILO ang CLO {number}.",
	"system.the_plan_covers_count_of_18_weeks_071ff7": "Saklaw ng plano ang {count} sa 18 linggo.",
	"system.list_at_least_3_course_requirements_9e2e96": "Maglista ng hindi bababa sa 3 kinakailangan sa kurso.",
	"system.group_has_no_entries_add_one_or_mark_it_not_applicable_6f5dab": "Walang nakalista sa {group}. Magdagdag ng isa o markahang hindi naaangkop.",
	"system.components_total_count_not_100_ac08a7": "{count}% ang kabuuan ng mga bahagi; dapat ay 100%.",
	"system.add_grading_components_495ddb": "Magdagdag ng mga bahagi ng pagmamarka.",
	"system.only_count_of_3_grading_terms_have_an_exam_row_in_the_learni_6f0dba": "{count} lamang sa 3 termino ng pagmamarka ang may hanay ng pagsusulit sa Plano ng Pagkatuto.",
	"system.override_formulas_cannot_be_empty_d52a12": "Hindi maaaring blangko ang mga sariling formula.",
	"system.this_syllabus_was_submitted_and_is_locked_you_can_edit_it_ag_982333": "Naipasa at naka-lock na ang silabus na ito. Mababago mo lamang ito kapag ibinalik ng administrador para baguhin.",
	"system.this_subject_is_no_longer_assigned_to_you_ca35b5": "Hindi na nakatalaga sa iyo ang asignaturang ito.",
	"system.no_program_or_subject_is_assigned_to_you_yet_ask_an_administ_b9d297": "Wala pang nakatalagang programa o asignatura sa iyo. Makipag-ugnayan sa administrador.",
	"system.a_program_is_assigned_to_you_but_no_subject_yet_ask_an_admin_a780fd": "May nakatalagang programa sa iyo, ngunit wala pang asignatura. Makipag-ugnayan sa administrador.",
	"system.a_draft_has_no_conversation_submit_it_for_review_first_then__882409": "Wala pang pag-uusap para sa draft. Ipasa muna ito para sa pagsusuri bago magpadala ng mensahe sa administrador.",
	"system.send_name_a_new_temporary_password_it_replaces_their_current_f8e59c": "Padalhan si {name} ng bagong pansamantalang password? Papalitan nito ang kasalukuyan nilang password, at kailangang pumili sila ng sarili sa susunod na pag-sign in.",
	"system.remove_name_they_will_no_longer_be_able_to_sign_in_and_their_1276ac": "Alisin si {name}? Hindi na sila makakapag-sign in at mabubura ang kanilang mga silabus.",
	"system.delete_clo_number_ilos_in_saved_syllabi_that_are_tagged_with_5e1afb": "Burahin ang CLO {number}? Hindi na matutukoy ang kaugnayan nito sa mga ILO ng naka-save na silabus hangga't hindi inaayos ng guro.",
	"system.delete_subject_syllabi_that_use_it_keep_the_outcomes_they_we_b64be5": "Burahin ang {subject}? Mananatili ang dating kinalabasan sa mga silabus na gumagamit nito, ngunit hindi na ito mapipili sa mga bagong draft.",
	"system.items_will_be_removed_for_all_count_program_subjects_continu_9fe9b2": "Aalisin ang {items} para sa lahat ng {count} asignatura ng {program}. Magpatuloy?",
	"system.email_isn_t_set_up_on_the_server_yet_add_the_smtp_settings_t_0b00f2": "Hindi pa naka-set up ang email sa server. Idagdag ang mga setting ng SMTP sa server/.env at i-restart ito.",
	"system.the_mail_server_rejected_the_username_or_password_in_server__0a92d7": "Tinanggihan ng mail server ang username o password sa server/.env.",
	"system.the_mail_server_could_not_be_reached_check_smtp_host_and_smt_776ecc": "Hindi makakonekta sa mail server. Suriin ang SMTP_HOST at SMTP_PORT sa server/.env.",
	"system.the_email_could_not_be_sent_see_the_server_log_for_the_reaso_9cb8d8": "Hindi maipadala ang email. Tingnan ang dahilan sa talaan ng server.",
	"system.no_subject_is_assigned_yet_so_they_cannot_start_a_syllabus_u_b8fd22": "Wala pang nakatalagang asignatura kaya hindi sila makakagawa ng silabus hangga't hindi ka nagtatalaga.",
	"system.topics_covered_c9aa8d": "Mga paksang saklaw",
	"system.one_per_line_3cfc5d": "- Isa sa bawat linya",
	"system.core_value_cee550": "**Pangunahing pagpapahalaga**",
	"system.examination_e526b8": "- Pagsusulit",
	"system.removed_outcome_dd0787": "Naalis na kinalabasan",
	"system.untitled_outcome_841f6c": "Kinalabasang walang pamagat",
	"system.unknown_tag_2e8a4c": "Hindi kilalang ugnayan",
	"system.not_in_the_program_ega_list_88302f": "Wala sa listahan ng EGA ng {program}",
	"system.not_in_the_program_list_1689f4": "Wala sa listahan ng {program}",
	"system.program_only_f0974a": "{program} lamang",
	"system.program_all_subjects_f2b882": "{program} · lahat ng asignatura",
	"system.format_compliance_f05ff9": "Pagsunod sa Format",
	"system.content_completeness_bd5188": "Pagkakumpleto ng Nilalaman",
	"system.co_po_alignment_049bbc": "Pagtutugma ng CO–PO",
	"system.assessment_alignment_c9b632": "Pagtutugma ng Pagtataya",
	"system.contact_hours_1d12f9": "Oras ng Klase",
	"system.reference_currency_7c7576": "Pagiging Napapanahon ng Sanggunian",
	"system.needs_work_eafabc": "Kailangang ayusin",
	"system.prelim_b5db4e": "Paunang pagsusulit",
	"system.midterm_7cdaaa": "Gitnang pagsusulit",
	"system.final_672b22": "Panghuling pagsusulit",
	"system.schedule_0a8ada": "Iskedyul",
	"system.intended_learning_outcomes_ilo_57ef01": "Mga Inaasahang Kinalabasan ng Pagkatuto (ILO)",
	"system.course_contents_8115c9": "Nilalaman ng Kurso",
	"system.suggested_learning_activities_df568c": "Mga Iminungkahing Gawain sa Pagkatuto",
	"system.suggested_assessment_tasks_26748f": "Mga Iminungkahing Gawain sa Pagtataya",
	"system.expected_value_s_to_be_integrated_786252": "Mga Inaasahang Pagpapahalagang Isasama",
	"system.course_code_i_is_empty_fd348f": "Walang code ng kurso (I).",
	"system.enter_the_course_code_477e29": "Ilagay ang code ng kurso",
	"system.course_title_ii_is_empty_7bb3ba": "Walang pamagat ng kurso (II).",
	"system.enter_the_course_title_2b2ee7": "Ilagay ang pamagat ng kurso",
	"system.program_is_empty_660fdf": "Walang nakalagay na programa.",
	"system.choose_the_program_574ae3": "Piliin ang programa",
	"system.course_description_iii_is_empty_fb57e2": "Walang paglalarawan ng kurso (III).",
	"system.write_the_course_description_99aa63": "Isulat ang paglalarawan ng kurso",
	"system.pre_requisite_iv_is_empty_8a7698": "Walang paunang kailangan (IV).",
	"system.enter_the_pre_requisite_2b9d4e": "Ilagay ang paunang kailangan",
	"system.lecture_and_laboratory_units_v_are_not_both_entered_447d6b": "Hindi parehong nakalagay ang mga yunit sa lektura at laboratoryo (V).",
	"system.enter_the_lecture_and_laboratory_units_3a7a57": "Ilagay ang mga yunit sa lektura at laboratoryo",
	"system.there_are_no_course_learning_outcomes_vi_ff0054": "Walang mga kinalabasan ng pagkatuto sa kurso (VI).",
	"system.ask_an_administrator_to_add_the_course_learning_outcomes_3bb261": "Hilingin sa administrador na idagdag ang mga kinalabasan ng pagkatuto sa kurso",
	"system.the_learning_plan_vii_has_no_lesson_with_a_learning_outcome__14a16b": "Walang araling may kinalabasan ng pagkatuto (ILO) sa Plano ng Pagkatuto (VII).",
	"system.add_a_lesson_with_a_learning_outcome_ilo_97bd34": "Magdagdag ng araling may kinalabasan ng pagkatuto (ILO)",
	"system.the_vision_in_this_syllabus_is_not_the_school_s_current_visi_595fb5": "Hindi tugma ang bisyon sa silabus na ito sa kasalukuyang bisyon ng paaralan.",
	"system.resubmit_so_the_syllabus_carries_the_current_vision_02d676": "Ipasa muli upang mailagay ang kasalukuyang bisyon sa silabus",
	"system.the_mission_in_this_syllabus_is_not_the_school_s_current_mis_2598ae": "Hindi tugma ang misyon sa silabus na ito sa kasalukuyang misyon ng paaralan.",
	"system.resubmit_so_the_syllabus_carries_the_current_mission_c9a873": "Ipasa muli upang mailagay ang kasalukuyang misyon sa silabus",
	"system.the_graduate_attributes_egas_in_this_syllabus_are_not_the_pr_7d925f": "Hindi tugma ang mga katangian ng nagtapos (EGA) sa silabus na ito sa kasalukuyang ginagamit ng programa.",
	"system.resubmit_so_the_syllabus_carries_the_current_graduate_attrib_1042dc": "Ipasa muli upang mailagay ang kasalukuyang mga katangian ng nagtapos",
	"system.the_program_outcomes_pos_in_this_syllabus_are_not_the_progra_289943": "Hindi tugma ang mga kinalabasan ng programa (PO) sa silabus na ito sa kasalukuyang ginagamit ng programa.",
	"system.resubmit_so_the_syllabus_carries_the_current_program_outcome_c781cd": "Ipasa muli upang mailagay ang kasalukuyang mga kinalabasan ng programa",
	"system.where_has_no_clo_tag_3391d4": "Walang kaugnay na CLO ang {where}.",
	"system.tag_every_ilo_with_the_clo_it_builds_a2a692": "Iugnay ang bawat ILO sa CLO na sinusuportahan nito",
	"system.where_has_a_tag_that_no_longer_resolves_tag_d45c61": "May ugnayang hindi na matukoy ang {where}: {tag}.",
	"system.fix_the_outcome_tags_that_no_longer_resolve_7ac93c": "Ayusin ang mga ugnayan ng kinalabasan na hindi na matukoy",
	"system.learning_plan_row_row_is_missing_the_column_missing_e31e3b": "Kulang ang hanay {row} ng Plano ng Pagkatuto ng kolum na: {missing}.",
	"system.complete_the_learning_plan_columns_569acd": "Kumpletuhin ang mga kolum ng Plano ng Pagkatuto",
	"system.where_has_nothing_in_missing_0f2c2a": "Walang laman ang {where} sa: {missing}.",
	"system.fill_in_the_empty_learning_plan_columns_1b6315": "Punan ang mga blangkong kolum ng Plano ng Pagkatuto",
	"system.where_has_an_empty_ilo_before_a_filled_one_so_the_printed_nu_67b7c6": "May blangkong ILO bago ang may laman sa {where}, kaya may laktaw sa bilang kapag na-print.",
	"system.remove_the_empty_ilo_between_filled_ones_432f5f": "Alisin ang blangkong ILO sa pagitan ng mga may laman",
	"system.learning_plan_row_row_comes_before_an_earlier_week_f455ca": "Nauuna ang hanay {row} ng Plano ng Pagkatuto sa mas maagang linggo.",
	"system.put_the_learning_plan_rows_in_week_order_1c1173": "Ayusin ang mga hanay ng Plano ng Pagkatuto ayon sa linggo",
	"system.course_requirements_viii_have_listed_at_least_need_needed_3373ac": "Mga kinakailangan sa kurso (VIII): {have} ang nakalista, kailangan ng hindi bababa sa {need}.",
	"system.list_at_least_three_course_requirements_492883": "Maglista ng hindi bababa sa tatlong kinakailangan sa kurso",
	"system.requirement_text_starts_with_its_own_number_the_form_numbers_cc2545": "Nagsisimula sa sariling bilang ang kinakailangang \"{text}\"; awtomatikong nilalagyan ng bilang ng form ang listahan.",
	"system.remove_the_typed_numbers_from_the_requirements_778c2b": "Alisin ang manu-manong bilang sa mga kinakailangan",
	"system.references_letter_title_has_no_entries_and_is_not_marked_not_db9de6": "Walang nakalista sa mga sanggunian ({letter}. {title}) at hindi ito minarkahang hindi naaangkop.",
	"system.fill_in_each_reference_group_or_mark_it_not_applicable_017773": "Punan ang bawat pangkat ng sanggunian o markahang hindi naaangkop",
	"system.references_letter_title_is_marked_not_applicable_but_has_ent_837d7c": "Minarkahang hindi naaangkop ang mga sanggunian ({letter}. {title}) ngunit may nakalista rito.",
	"system.resolve_the_reference_group_marked_not_applicable_that_has_e_7431c1": "Ayusin ang pangkat ng sangguniang minarkahang hindi naaangkop ngunit may laman",
	"system.the_grading_system_x_has_no_components_6bedcc": "Walang mga bahagi ang Sistema ng Pagmamarka (X).",
	"system.add_the_grading_components_6379f7": "Idagdag ang mga bahagi ng pagmamarka",
	"system.the_grading_components_total_total_not_need_7af3a4": "{total}% ang kabuuan ng mga bahagi ng pagmamarka; dapat ay {need}%.",
	"system.make_the_grading_components_total_100_1c1296": "Gawing 100% ang kabuuan ng mga bahagi ng pagmamarka",
	"system.the_override_formulas_cannot_be_empty_16b132": "Hindi maaaring blangko ang mga sariling formula.",
	"system.fill_in_the_override_formulas_or_switch_them_off_ef3080": "Punan ang mga sariling formula o i-off ang mga ito",
	"system.the_which_formula_does_not_mention_missing_115864": "Hindi binabanggit ng formula ng {which} ang {missing}.",
	"system.make_the_grading_formulas_name_every_component_and_exam_term_254c69": "Banggitin sa mga formula ang bawat bahagi at termino ng pagsusulit",
	"system.the_sign_off_block_is_not_as_the_form_requires_problem_e789b0": "Hindi naaayon sa form ang bahagi ng pagpapatibay: {problem}.",
	"system.check_the_sign_off_block_a1220a": "Suriin ang bahagi ng pagpapatibay",
	"system.the_course_description_is_words_nouns_about_need_are_expecte_59286a": "May {words} salita ang paglalarawan ng kurso; inaasahan ang humigit-kumulang {need}.",
	"system.expand_the_course_description_2cc109": "Palawakin ang paglalarawan ng kurso",
	"system.where_is_only_words_nouns_an_ilo_states_what_the_student_wil_6bff9d": "May {words} salita lamang ang {where}; dapat sabihin ng ILO kung ano ang gagawin ng estudyante.",
	"system.write_fuller_learning_outcomes_ilos_654df1": "Palawakin ang mga kinalabasan ng pagkatuto (ILO)",
	"system.clo_n_has_no_missing_e2c4c2": "Walang {missing} ang CLO {n}.",
	"system.ask_an_administrator_to_complete_the_clo_titles_and_statemen_0a783c": "Hilingin sa administrador na kumpletuhin ang mga pamagat at pahayag ng CLO",
	"system.there_are_have_references_at_least_need_are_expected_52dfcd": "May {have} sanggunian; inaasahan ang hindi bababa sa {need}.",
	"system.add_more_references_06d9a2": "Magdagdag pa ng sanggunian",
	"system.clo_n_is_not_tagged_with_a_valid_graduate_attribute_ega_c6f5fc": "Walang kaugnay na wastong katangian ng nagtapos (EGA) ang CLO {n}.",
	"system.ask_an_administrator_to_tag_each_clo_with_graduate_attribute_b65c4f": "Hilingin sa administrador na iugnay ang bawat CLO sa mga katangian ng nagtapos",
	"system.clo_n_is_not_tagged_with_a_valid_program_outcome_po_ba7e86": "Walang kaugnay na wastong kinalabasan ng programa (PO) ang CLO {n}.",
	"system.ask_an_administrator_to_tag_each_clo_with_program_outcomes_abd819": "Hilingin sa administrador na iugnay ang bawat CLO sa mga kinalabasan ng programa",
	"system.clo_n_is_tagged_po_po_which_maps_to_ega_ega_but_ega_ega_is_n_9ce3b8": "Kaugnay ng CLO {n} ang PO {po} na tumutugma sa EGA {ega}, ngunit hindi nakaugnay ang EGA {ega}.",
	"system.ask_an_administrator_to_tag_the_egas_the_pos_imply_e098e4": "Hilingin sa administrador na iugnay ang mga EGA na sinusuportahan ng mga PO",
	"system.clo_n_s_tags_would_not_print_as_format_numbers_must_be_uniqu_b8d35a": "Hindi maipi-print ang mga ugnayan ng CLO {n} bilang {format}: dapat natatangi at sunod-sunod ang mga bilang.",
	"system.ask_an_administrator_to_put_the_clo_tags_in_order_b354b9": "Hilingin sa administrador na ayusin ang pagkakasunod ng mga ugnayan ng CLO",
	"system.clo_n_is_not_built_by_any_ilo_in_the_learning_plan_0f9245": "Walang ILO sa Plano ng Pagkatuto na sumusuporta sa CLO {n}.",
	"system.cover_every_course_outcome_in_the_learning_plan_73d996": "Isama ang bawat kinalabasan ng kurso sa Plano ng Pagkatuto",
	"system.where_has_no_assessment_task_1818c7": "Walang gawain sa pagtataya ang {where}.",
	"system.add_an_assessment_task_to_every_lesson_003cd7": "Magdagdag ng gawain sa pagtataya sa bawat aralin",
	"system.clo_n_is_not_assessed_no_week_that_builds_it_has_an_assessme_45b49b": "Hindi natataya ang CLO {n}: walang gawain sa pagtataya ang mga linggong sumusuporta rito.",
	"system.assess_every_course_learning_outcome_d14b14": "Tayain ang bawat kinalabasan ng pagkatuto sa kurso",
	"system.there_is_no_term_examination_row_in_the_learning_plan_816d16": "Walang hanay ng pagsusulit para sa {term} sa Plano ng Pagkatuto.",
	"system.add_the_missing_examination_rows_6f0651": "Idagdag ang mga kulang na hanay ng pagsusulit",
	"system.the_grading_system_has_no_examination_component_6b9221": "Walang bahagi ng pagsusulit ang sistema ng pagmamarka.",
	"system.include_an_examination_in_the_grading_system_55917d": "Isama ang pagsusulit sa sistema ng pagmamarka",
	"system.the_credit_units_are_not_usable_lecture_lecture_laboratory_l_7c7023": "Hindi magamit ang mga yunit: lektura {lecture}, laboratoryo {lab}.",
	"system.correct_the_credit_units_6cbf75": "Itama ang mga yunit",
	"system.the_plan_covers_planned_of_expected_weeks_hours_b1a9b0": "Saklaw ng plano ang {planned} sa {expected} linggo{hours}.",
	"system.plan_the_full_term_bf8886": "Planuhin ang buong termino",
	"system.row_row_has_a_week_that_is_not_within_1_to_to_week_88575b": "May linggo sa hanay {row} na labas sa 1 hanggang {to}: \"{week}\".",
	"system.fix_the_weeks_outside_the_term_c8d435": "Ayusin ang mga linggong labas sa termino",
	"system.week_s_weeks_appear_verb_in_more_than_one_row_890453": "Lumilitaw ang linggo {weeks} sa higit sa isang hanay.",
	"system.resolve_the_weeks_used_by_more_than_one_row_c697a4": "Ayusin ang mga linggong ginagamit sa higit sa isang hanay",
	"system.there_are_no_references_bea2c0": "Walang mga sanggunian.",
	"system.add_references_4eb0e8": "Magdagdag ng mga sanggunian",
	"system.a_reference_has_no_year_text_88645f": "Walang taon ang sanggunian: \"{text}\".",
	"system.add_the_year_to_each_reference_7d6b56": "Idagdag ang taon sa bawat sanggunian",
	"system.a_reference_is_age_years_old_year_the_limit_is_limit_text_51f7a0": "May edad na {age} taon ang sanggunian ({year}); {limit} ang hangganan: \"{text}\".",
	"system.replace_the_outdated_references_2a9002": "Palitan ang mga lumang sanggunian",
	"system.count_more_like_this_2e9cf6": "May {count} pang katulad nito.",
	"system.word_44363c": "Salita",
	"system.word_3cbcd9": "salita",
	"system.words_efb893": "salita",
	"system.week_week_971fff": "Linggo {week}",
	"system.week_week_ilo_ilo_5617d6": "Linggo {week}, ILO {ilo}",
	"system.row_row_b8e5d8": "Hanay {row}",
	"system.uploaded_file_8f6beb": "na-upload na file",
	"system.submit_anyway_aae672": "Ipasa pa rin",
	"system.save_as_new_version_anyway_cab83b": "I-save pa rin bilang bagong bersiyon",
	"system.sep_492c5f": "SET",
	"system.token_is_required_754957": "Kailangan ang token",
	"system.google_sign_in_is_not_configured_on_the_server_60dab7": "Hindi naka-configure sa server ang Google sign-in.",
	"system.server_is_missing_its_jwt_secret_4d6f02": "Walang JWT secret ang server.",
	"system.google_sign_in_could_not_be_verified_please_try_again_df4f63": "Hindi maberipika ang Google sign-in. Subukan muli.",
	"system.access_denied_only_p0_accounts_can_sign_in_e2567b": "Hindi pinapayagan ang access. Mga account na @{p0} lamang ang maaaring mag-sign in.",
	"system.access_denied_your_account_is_not_registered_in_the_system_1b64a2": "Hindi pinapayagan ang access. Hindi nakarehistro sa sistema ang iyong account.",
	"system.sign_in_failed_because_of_a_server_error_please_try_again_e375a1": "Hindi nakapag-sign in dahil sa error sa server. Subukan muli.",
	"system.access_denied_account_not_registered_5a9a06": "Hindi pinapayagan ang access. Hindi nakarehistro ang account.",
	"system.invalid_email_or_password_c0494c": "Mali ang email o password",
	"system.your_registration_is_waiting_for_an_administrator_to_verify__1936d8": "Naghihintay ang iyong pagpaparehistro sa administrador upang beripikahin ang iyong COR.",
	"system.your_registration_was_rejected_contact_the_administrator_b2590e": "Tinanggihan ang iyong pagpaparehistro. Makipag-ugnayan sa administrador.",
	"system.logged_out_25edfa": "Nakapag-sign out",
	"system.enter_the_email_address_you_registered_with_8e2dd3": "Ilagay ang email address na ginamit mo sa pagpaparehistro.",
	"system.too_many_requests_try_again_in_6eba4a": "Masyadong maraming kahilingan. Subukan muli pagkalipas ng",
	"system.minute_s_3bb3d5": "minuto.",
	"system.account_not_found_9dad66": "Hindi nahanap ang account",
	"system.your_current_password_is_not_correct_c8309a": "Mali ang kasalukuyan mong password.",
	"system.your_password_was_changed_3c5172": "Napalitan ang iyong password.",
	"system.the_password_could_not_be_changed_because_of_a_server_error_a06d94": "Hindi mapalitan ang password dahil sa error sa server.",
	"system.not_authenticated_0c91ac": "Hindi naka-sign in",
	"system.syllabus_not_found_84d0f7": "Hindi nahanap ang silabus",
	"system.only_the_faculty_member_who_owns_the_syllabus_reads_its_comm_12f062": "Ang gurong nagmamay-ari lamang ng silabus ang maaaring magbasa ng mga komento nito",
	"system.only_administrators_can_add_reviewer_comments_1482e8": "Mga administrador lamang ang maaaring magdagdag ng komento ng tagasuri",
	"system.new_reviewer_comment_p0_456700": "Bagong komento ng tagasuri: {p0}",
	"system.your_syllabus_9346a1": "iyong silabus",
	"system.must_be_a_valid_date_b521a8": "ay dapat wastong petsa",
	"system.only_an_administrator_can_read_the_check_history_3a67e4": "Administrador lamang ang maaaring magbasa ng kasaysayan ng pagsusuri",
	"system.only_the_owner_or_an_administrator_can_check_a_syllabus_7b9c8a": "May-ari o administrador lamang ang maaaring magsuri ng silabus",
	"system.there_is_nothing_to_check_yet_save_some_of_the_form_first_819809": "Wala pang masusuri. I-save muna ang ilang bahagi ng form.",
	"system.you_are_checking_too_often_try_again_in_c75a7d": "Masyadong madalas ang pagsusuri. Subukan muli pagkalipas ng",
	"system.seconds_07ba64": "segundo.",
	"system.syllabus_must_be_all_or_a_syllabus_id_fdf7a4": "Ang syllabus ay dapat \"all\" o ID ng silabus",
	"system.from_must_not_be_after_to_49e6f2": "Hindi dapat mas huli ang mula kaysa sa hanggang",
	"system.check_not_found_d8745c": "Hindi nahanap ang pagsusuri",
	"system.subject_not_found_20a5c9": "Hindi nahanap ang asignatura",
	"system.p0_is_required_37b0d1": "Kailangan ang {p0}",
	"system.p0_is_too_long_max_p1_characters_3a1bb2": "Masyadong mahaba ang {p0} (hanggang {p1} character)",
	"system.enter_the_program_code_e557a0": "Ilagay ang code ng programa",
	"system.a_program_code_uses_2_to_20_letters_digits_or_hyphens_for_ex_68dac5": "Gumamit ng 2 hanggang 20 letra, numero o gitling para sa code ng programa, halimbawa BSIT.",
	"system.enter_the_program_s_full_name_ca46e4": "Ilagay ang buong pangalan ng programa",
	"system.the_program_s_name_needs_at_least_two_letters_add65b": "Kailangan ng hindi bababa sa dalawang letra sa pangalan ng programa",
	"system.the_program_name_is_too_long_max_255_characters_e7d4a8": "Masyadong mahaba ang pangalan ng programa (hanggang 255 character)",
	"system.p0_already_exists_1c0019": "Mayroon nang {p0}",
	"system.subject_deleted_bd354d": "Nabura ang asignatura",
	"system.provide_a_list_of_up_to_20_clos_2e9e3e": "Magbigay ng listahang may hanggang 20 CLO",
	"system.p0_is_invalid_1cc5a9": "Hindi wasto ang {p0}",
	"system.p0_does_not_belong_to_this_subject_9b84ee": "Hindi kabilang sa asignaturang ito ang {p0}",
	"system.p0_needs_a_level_p1_2aba59": "Kailangan ng antas ({p1}) ang {p0}",
	"system.p0_has_an_ega_that_does_not_exist_in_p1_aa5e5d": "May EGA ang {p0} na wala sa {p1}",
	"system.p0_has_a_program_outcome_that_does_not_exist_in_p1_3f7361": "May kinalabasan ng programa ang {p0} na wala sa {p1}",
	"system.p0_title_ed4c90": "Pamagat ng {p0}",
	"system.a_clo_appears_twice_ba6361": "May CLO na nakalista nang dalawang beses",
	"system.mission_needs_1_to_20_items_f09f0c": "Kailangan ng 1 hanggang 20 pahayag sa misyon",
	"system.provide_1_to_20_egas_927119": "Magbigay ng 1 hanggang 20 EGA",
	"system.ega_p0_needs_a_unique_number_from_1_to_99_9c30a9": "Kailangan ng natatanging bilang mula 1 hanggang 99 ang EGA {p0}",
	"system.mapping_saved_cc9629": "Na-save ang pagmamapa",
	"system.you_are_not_part_of_this_conversation_f74315": "Hindi ka kabilang sa pag-uusap na ito",
	"system.message_cannot_be_empty_3da76c": "Hindi maaaring blangko ang mensahe",
	"system.message_is_too_long_max_p0_characters_f26dd8": "Masyadong mahaba ang mensahe (hanggang {p0} character)",
	"system.no_administrator_is_available_to_receive_this_message_38532c": "Walang administrador na makatatanggap ng mensaheng ito",
	"system.new_message_from_p0_p1_5b9ea7": "Bagong mensahe mula kina {p0} {p1}",
	"system.message_sent_9cf1b6": "Naipadala ang mensahe",
	"system.messages_marked_as_read_93bb46": "Minarkahang nabasa ang mga mensahe",
	"system.notifications_marked_as_read_ce3f92": "Minarkahang nabasa ang mga abiso",
	"system.notification_not_found_4ada2b": "Hindi nahanap ang abiso",
	"system.notification_marked_as_read_37370f": "Minarkahang nabasa ang abiso",
	"system.provide_a_list_of_up_to_50_program_outcomes_a81c10": "Magbigay ng listahang may hanggang 50 kinalabasan ng programa",
	"system.outcome_p0_needs_a_unique_number_from_1_to_99_a02620": "Kailangan ng natatanging bilang mula 1 hanggang 99 ang kinalabasang {p0}",
	"system.po_p0_needs_a_short_name_max_120_characters_ffb8e8": "Kailangan ng maikling pangalan ang PO {p0} (hanggang 120 character)",
	"system.po_p0_needs_its_statement_max_2000_characters_00b038": "Kailangan ng pahayag ang PO {p0} (hanggang 2000 character)",
	"system.po_p0_maps_to_an_ega_that_does_not_exist_in_p1_c8b2f1": "Kaugnay ng PO {p0} ang EGA na wala sa {p1}",
	"system.upload_a_photo_of_your_cor_jpg_png_or_webp_b5323e": "Mag-upload ng larawan ng iyong COR (JPG, PNG o WebP).",
	"system.too_many_attempts_try_again_later_d8d0c2": "Masyadong maraming pagsubok. Subukan muli mamaya.",
	"system.choose_a_photo_of_your_cor_63bb6c": "Pumili ng larawan ng iyong COR.",
	"system.we_could_not_read_the_student_id_on_your_cor_retake_the_phot_65b820": "Hindi namin mabasa ang student ID sa iyong COR. Kunan muli ang buong pahina, patag at may sapat na liwanag.",
	"system.use_a_password_of_at_least_8_characters_69cc28": "Gumamit ng password na may hindi bababa sa 8 character.",
	"system.scan_your_cor_again_to_continue_408e38": "I-scan muli ang iyong COR upang magpatuloy.",
	"system.this_student_id_is_already_registered_sign_in_instead_2144d0": "Nakarehistro na ang student ID na ito. Mag-sign in na lamang.",
	"system.your_account_is_ready_sign_in_with_your_student_id_and_passw_53505f": "Handa na ang iyong account. Mag-sign in gamit ang iyong student ID at password.",
	"system.your_account_was_created_and_is_waiting_for_an_administrator_cda09e": "Nagawa ang iyong account at naghihintay sa administrador upang beripikahin ang iyong COR.",
	"system.students_only_21951b": "Para lamang sa mga estudyante",
	"system.no_cor_on_file_9a0b0b": "Walang naka-save na COR",
	"system.decision_must_be_approve_or_reject_f8dfd0": "Ang pasya ay dapat approve o reject",
	"system.no_pending_registration_for_that_student_61356c": "Walang naghihintay na pagpaparehistro para sa estudyanteng iyon",
	"system.student_verified_9e05d9": "Naberipika ang estudyante",
	"system.registration_rejected_f73477": "Tinanggihan ang pagpaparehistro",
	"system.only_pdf_files_are_accepted_938e78": "Mga PDF file lamang ang tinatanggap",
	"system.title_is_too_long_max_255_characters_7af545": "Masyadong mahaba ang pamagat (hanggang 255 character)",
	"system.course_code_is_too_long_max_50_characters_e90333": "Masyadong mahaba ang code ng kurso (hanggang 50 character)",
	"system.new_syllabus_submitted_p0_5b562d": "Bagong naipasang silabus: {p0}",
	"system.p0_p1_submitted_p2_for_review_657f78": "Ipinasa nina {p0} {p1} ang {p2} para sa pagsusuri.",
	"system.syllabus_uploaded_860a4e": "Na-upload ang silabus",
	"system.only_administrators_can_change_a_syllabus_status_b305ae": "Mga administrador lamang ang maaaring magbago ng kalagayan ng silabus",
	"system.invalid_status_28b5a7": "Hindi wastong kalagayan",
	"system.administrators_cannot_edit_syllabus_content_6ddaca": "Hindi maaaring baguhin ng administrador ang nilalaman ng silabus",
	"system.reviewer_comment_p0_0caf52": "Komento ng tagasuri: {p0}",
	"system.syllabus_updated_904e23": "Na-update ang silabus",
	"system.p0_p1_submitted_p2_uploaded_file_for_review_445d4a": "Ipinasa nina {p0} {p1} ang {p2} (na-upload na file) para sa pagsusuri.",
	"system.syllabus_updated_during_review_p0_p1_9c07d5": "Na-update ang silabus habang sinusuri: {p0} ({p1})",
	"system.syllabus_resubmitted_p0_p1_fb861c": "Naipasa muli ang silabus: {p0} ({p1})",
	"system.p0_p1_saved_a_new_version_ee2612": "Nag-save sina {p0} {p1} ng bagong bersiyon.",
	"system.only_draft_syllabi_can_be_deleted_by_faculty_832244": "Mga draft na silabus lamang ang maaaring burahin ng guro.",
	"system.this_syllabus_changed_or_was_removed_refresh_your_list_befor_71c4b3": "Nabago o naalis ang silabus na ito. I-refresh ang listahan bago burahin.",
	"system.syllabus_deleted_0c0a2d": "Nabura ang silabus",
	"system.sections_must_be_an_object_with_at_least_one_section_016336": "Ang sections ay dapat object na may kahit isang bahagi",
	"system.unknown_section_p0_150c8c": "Hindi kilalang bahagi na \"{p0}\"",
	"system.section_p0_must_be_p1_c0c5a6": "Ang bahaging \"{p0}\" ay dapat {p1}",
	"system.a_list_e3206e": "isang listahan",
	"system.an_object_6d24ab": "isang object",
	"system.meta_p0_must_be_text_e0c2cb": "Ang meta.{p0} ay dapat teksto",
	"system.meta_courseid_must_be_a_course_id_70c04c": "Ang meta.courseId ay dapat ID ng kurso",
	"system.each_plan_row_needs_an_ilos_list_c15fb3": "Kailangan ng listahan ng ILO sa bawat hanay ng plano",
	"system.ilo_tags_must_look_like_clo_id_ega_no_or_po_no_929dd3": "Ang mga ugnayan ng ILO ay dapat clo:<id>, ega:<no> o po:<no>",
	"system.that_course_does_not_exist_9b4df4": "Walang ganoong kurso",
	"system.only_the_owner_can_edit_syllabus_content_ceacae": "May-ari lamang ang maaaring magbago ng nilalaman ng silabus",
	"system.this_syllabus_is_too_large_to_save_limit_p0_kb_ce0b6e": "Masyadong malaki ang silabus upang i-save (hanggang {p0} KB)",
	"system.version_not_found_8ae7d0": "Hindi nahanap ang bersiyon",
	"system.only_the_owner_can_submit_a_syllabus_78da25": "May-ari lamang ang maaaring magpasa ng silabus",
	"system.choose_a_course_before_submitting_2d67db": "Pumili ng kurso bago magpasa",
	"system.this_syllabus_is_too_large_to_submit_limit_p0_kb_b272fc": "Masyadong malaki ang silabus upang ipasa (hanggang {p0} KB)",
	"system.p0_submitted_p1_for_review_dfad43": "Ipinasa ni {p0} ang {p1} para sa pagsusuri.",
	"system.p0_saved_a_new_version_4242a0": "Nag-save si {p0} ng bagong bersiyon.",
	"system.enter_a_first_and_last_name_each_between_1_and_100_character_96bc58": "Ilagay ang pangalan at apelyido, na may 1 hanggang 100 character bawat isa.",
	"system.profile_editing_is_available_to_faculty_and_administrators_0e222d": "Maaaring baguhin ng guro at administrador ang kanilang profile.",
	"system.could_not_save_your_name_please_try_again_7c17e6": "Hindi ma-save ang iyong pangalan. Subukan muli.",
	"system.language_preferences_are_available_to_faculty_and_administra_45e04c": "Maaaring pumili ng wika ang mga guro at administrador.",
	"system.could_not_save_your_language_preference_please_try_again_479b33": "Hindi ma-save ang iyong napiling wika. Subukan muli.",
	"system.first_name_last_name_and_email_are_required_5bef18": "Kailangan ang first_name, last_name at email",
	"system.invalid_email_address_9e4ee6": "Hindi wastong email address",
	"system.use_an_institutional_email_address_ending_in_9e7715": "Gumamit ng email address ng institusyon na nagtatapos sa @",
	"system.invalid_role_110637": "Hindi wastong tungkulin",
	"system.a_user_with_this_email_is_already_registered_c4ac56": "May nakarehistrong user na may email na ito",
	"system.user_not_found_01eb94": "Hindi nahanap ang user",
	"system.you_cannot_reset_your_own_password_here_f82f48": "Hindi mo maaaring i-reset ang sarili mong password dito.",
	"system.you_are_sending_too_often_try_again_in_a9f2af": "Masyadong madalas ang pagpapadala. Subukan muli pagkalipas ng",
	"system.this_account_signs_in_with_a_student_id_not_an_email_address_1adadc": "Gumagamit ang account na ito ng student ID sa pag-sign in, hindi email address.",
	"system.only_faculty_can_be_assigned_programs_and_courses_b37245": "Mga guro lamang ang maaaring italaga sa mga programa at kurso",
	"system.your_program_and_course_assignments_were_updated_99f59c": "Na-update ang iyong mga nakatalagang programa at kurso",
	"system.you_can_now_create_syllabi_for_p0_subject_p1_6151c9": "Maaari ka nang gumawa ng silabus para sa {p0} asignatura.",
	"system.no_program_or_subject_is_assigned_to_you_right_now_ask_an_ad_3c3272": "Wala pang nakatalagang programa o asignatura sa iyo ngayon. Makipag-ugnayan sa administrador.",
	"system.photo_sync_is_available_to_faculty_and_administrators_9274ed": "Maaaring mag-sync ng larawan ang mga guro at administrador.",
	"system.could_not_sync_your_google_photo_please_try_again_766713": "Hindi ma-sync ang iyong larawan sa Google. Subukan muli.",
	"system.image_is_too_large_the_maximum_size_is_2_mb_74f7ce": "Masyadong malaki ang larawan. Hanggang 2 MB lamang.",
	"system.upload_the_image_in_the_avatar_field_one_file_only_743788": "I-upload ang isang larawan lamang sa field na \"avatar\".",
	"system.the_upload_could_not_be_processed_bd0108": "Hindi maproseso ang pag-upload.",
	"system.no_image_uploaded_choose_a_jpeg_png_or_webp_file_e49009": "Walang na-upload na larawan. Pumili ng larawang JPEG, PNG o WebP.",
	"system.unsupported_file_use_a_jpeg_png_or_webp_image_2cbb3b": "Hindi suportado ang file. Gumamit ng larawang JPEG, PNG o WebP.",
	"system.could_not_save_your_photo_please_try_again_025939": "Hindi ma-save ang iyong larawan. Subukan muli.",
	"system.could_not_remove_your_photo_please_try_again_c15b90": "Hindi maalis ang iyong larawan. Subukan muli.",
	"system.could_not_load_that_photo_d8550e": "Hindi ma-load ang larawang iyon.",
	"system.could_not_remove_that_photo_please_try_again_36e6fd": "Hindi maalis ang larawang iyon. Subukan muli.",
	"system.you_cannot_remove_your_own_account_bd66f1": "Hindi mo maaaring alisin ang sarili mong account",
	"system.user_deleted_c7134d": "Nabura ang user",
	"system.outcome_6c0d09": "Kinalabasan",
	"system.computer_programming_2_982f6f": "Computer Programming 2",
	"system.outcome_1_aa5458": "Kinalabasan 1",
	"system.outcome_2_e383b4": "Kinalabasan 2",
	"system.review_b0b704": "Suriin",
	"system.the_ai_provider_took_too_long_c7b397": "Masyadong matagal tumugon ang AI provider.",
	"system.no_ai_provider_is_configured_00ebb2": "Walang naka-configure na AI provider.",
	"system.the_ai_returned_nothing_usable_8ebcb9": "Walang maayos na resultang ibinalik ang AI.",
	"system.unknown_compliance_check_70fd9f": "Hindi kilalang pagsusuri sa pagsunod na \"",
	"system.in_rule_c5c19c": "\" sa tuntunin",
	"system.this_syllabus_does_not_follow_the_form_yet_f5f6b7": "Hindi pa sumusunod sa form ang silabus na ito:",
	"system.and_faa75a": "(at",
	"system.more_02dbfc": "pa).",
	"system.the_uploaded_file_could_not_be_found_on_the_server_or_it_is__72ee5a": "Hindi nahanap sa server ang na-upload na file, o blangko ito.",
	"system.the_file_is_not_a_complete_pdf_document_the_pdf_header_or_en_087d98": "Hindi kumpletong dokumentong PDF ang file (kulang ang header o end marker). Hilingin sa guro na i-upload itong muli.",
	"system.the_pdf_is_password_protected_so_a_reviewer_cannot_open_it_2b4816": "May password ang PDF kaya hindi ito mabuksan ng tagasuri.",
	"system.the_course_code_and_title_were_not_entered_with_the_upload_669725": "Hindi naisama ang code at pamagat ng kurso sa pag-upload.",
	"system.no_program_is_linked_to_this_upload_c74cd6": "Walang programang kaugnay ng na-upload na ito.",
	"system.the_pdf_has_only_one_page_a_syllabus_in_the_university_form__0d17bb": "Isang pahina lamang ang PDF. Karaniwang maraming pahina ang silabus sa form ng unibersidad, kaya maaaring kulang ang file na ito.",
	"system.matching_to_the_template_is_not_done_yet_05bb3c": "Hindi pa naihahambing sa template",
	"system.verify_your_google_workspace_account_to_sync_its_photo_1358d8": "Beripikahin ang iyong Google Workspace account upang ma-sync ang larawan nito.",
	"system.google_photo_sync_is_not_configured_on_the_server_05b1d3": "Hindi naka-configure sa server ang pag-sync ng larawan sa Google.",
	"system.google_account_verification_failed_please_try_again_f198d6": "Hindi naberipika ang Google account. Subukan muli.",
	"system.choose_the_google_workspace_account_that_matches_your_signed_b30c33": "Piliin ang Google Workspace account na katugma ng email na naka-sign in.",
	"system.this_google_account_has_no_available_profile_photo_01ce68": "Walang magagamit na larawan sa profile ang Google account na ito.",
	"system.the_google_profile_photo_url_is_not_supported_a7a1d4": "Hindi suportado ang URL ng larawan sa Google profile.",
	"system.photo_unavailable_9b5934": "Hindi magagamit ang larawan",
	"system.photo_too_large_865f37": "Masyadong malaki ang larawan",
	"system.could_not_import_your_google_photo_your_current_photo_has_be_7f02df": "Hindi ma-import ang iyong larawan sa Google. Pinanatili ang kasalukuyan mong larawan.",
	"system.google_photo_access_is_required_0a98bc": "Kailangan ang access sa larawan sa Google.",
	"system.google_photo_access_expired_or_could_not_be_verified_please__20e355": "Nag-expire o hindi maberipika ang access sa larawan sa Google. Subukan muli.",
	"system.google_photo_access_expired_or_belongs_to_another_applicatio_e3d6fc": "Nag-expire ang access sa larawan sa Google o para ito sa ibang application.",
	"system.profile_unavailable_a71ecd": "Hindi magagamit ang profile",
	"system.could_not_read_your_google_profile_your_current_photo_has_be_f4cb59": "Hindi mabasa ang iyong Google profile. Pinanatili ang kasalukuyan mong larawan.",
	"system.program_not_found_d00252": "Hindi nahanap ang programa",
	"system.that_name_is_already_used_by_p0_c61bec": "Ginagamit na ng {p0} ang pangalang iyon.",
	"system.that_program_was_just_created_try_again_a424d0": "Kakagawa lamang ng programang iyon. Subukan muli.",
	"system.write_a_comment_first_d1d999": "Sumulat muna ng komento.",
	"system.a_comment_can_be_at_most_p0_characters_999ad3": "Hanggang {p0} character lamang ang komento.",
	"system.say_why_the_syllabus_is_rejected_at_least_5_characters_90f81a": "Sabihin kung bakit tinatanggihan ang silabus (hindi bababa sa 5 character).",
	"system.say_what_needs_to_change_at_least_5_characters_9a51db": "Sabihin kung ano ang kailangang baguhin (hindi bababa sa 5 character).",
	"system.the_note_can_be_at_most_p0_characters_81a137": "Hanggang {p0} character lamang ang tala.",
	"system.shared_with_count_other_program_subject_suffix_subjects_a_ch_5beb94": "Ibinabahagi sa {count} pang asignatura ng {program}: {subjects}. Ilalapat sa lahat ng ito ang anumang pagbabago rito.",
	"system.only_course_uses_these_in_program_for_now_91f536": "Ang {course} lamang ang gumagamit nito sa {program} sa ngayon.",
	"system.the_vision_bfd77e": "ang bisyon",
	"system.the_mission_d1ed71": "ang misyon",
	"system.the_program_graduate_attributes_egas_e29d3c": "ang mga katangian ng nagtapos (EGA) ng {program}",
	"system.the_program_program_outcomes_e9730b": "ang mga kinalabasan ng programang {program}",
	"system.the_learning_outcomes_of_course_4eca34": "ang mga kinalabasan ng pagkatuto ng {course}",
	"system.approved_course_5e4f0e": "Aprubado: {course}",
	"system.returned_for_revision_course_7f8d1a": "Ibinalik para baguhin: {course}",
	"system.rejected_course_f88b82": "Tinanggihan: {course}",
	"system.title_3c6de1": "pamagat",
	"system.curriculum_4a130a": "kurikulum",
	"system.file_971c41": "file",
	"system.count_weeks_rows_rows_643e3d": "{count} linggo · {rows} hanay",
	"system.count_week_rows_row_0c3435": "{count} linggo · {rows} hanay",
	"system.count_week_rows_rows_a992ff": "{count} linggo · {rows} hanay",
	"system.count_weeks_rows_row_cbbeef": "{count} linggo · {rows} hanay",
	"system.count_submission_is_3fc1cc": "May {count} naipasa na",
	"system.count_submissions_are_459d69": "May {count} naipasa na",
	"system.it_appears_1befb1": "lalabas ito",
	"system.they_appear_061e31": "lalabas ang mga ito",
	"system.check_not_found_3de409": "Hindi nahanap ang pagsusuri.",
	"system.admin_access_required_737b16": "Kailangan ang access ng administrador",
	"system.not_available_for_student_accounts_0203b3": "Hindi magagamit ng mga account ng estudyante",
	"system.choose_your_own_password_before_you_continue_5bef53": "Pumili ng sarili mong password bago magpatuloy.",
	"system.message_count_more_like_this_c310da": "{message} May {count} pang katulad nito.",
	"system.course_course_is_not_assigned_to_you_fbe906": "Hindi nakatalaga sa iyo ang kursong {course}.",
	"system.field_is_required_f9caf4": "Kailangan ang {field}.",
	"system.password_must_be_at_least_8_characters_17ca64": "Dapat may hindi bababa sa 8 character ang password.",
	"system.could_not_load_your_account_please_try_again_707ae0": "Hindi ma-load ang iyong account. Subukan muli.",
	"system.the_password_must_be_at_least_count_characters_b23fc6": "Dapat may hindi bababa sa {count} character ang password.",
	"system.the_password_must_be_at_most_72_characters_acefd4": "Dapat hanggang 72 character lamang ang password.",
	"system.the_password_needs_at_least_one_letter_and_one_number_c6a439": "Kailangan ng password ng kahit isang letra at isang numero.",
	"system.the_password_must_not_be_your_email_address_41a5a6": "Hindi dapat kapareho ng iyong email address ang password.",
	"system.status_syllabi_can_t_be_edited_a73120": "Hindi maaaring baguhin ang mga silabus na {status}",
	"system.it_6c5522": "ito",
	"system.them_98910a": "mga ito",
	"system.language_change_was_not_saved_your_previous_language_has_bee_bb23ef": "Hindi na-save ang pagpapalit ng wika. Naibalik ang dati mong wika.",
	"system.form_section_510ca0": "BAHAGI NG FORM",
	"system.the_version_you_submitted_10446c": "bersiyong ipinasa mo",
	"system.the_next_version_eeb634": "susunod na bersiyon",
	"system.course_information_63dce9": "Impormasyon ng kurso",
	"system.course_description_17fff9": "Paglalarawan ng kurso",
	"system.learning_plan_2378ac": "Plano ng pagkatuto",
	"system.course_requirements_4f2446": "Mga kinakailangan sa kurso",
	"system.grading_system_51e556": "Sistema ng pagmamarka",
	"system.count_word_494d2c": "{count} salita",
	"system.count_words_c08299": "{count} salita",
	"system.count_week_8ba3e1": "{count} linggo",
	"system.count_weeks_cc8d5b": "{count} linggo",
	"system.complete_this_field_6ecc23": "Punan ang field na ito.",
	"system.enter_a_valid_email_address_2e09ed": "Ilagay ang wastong email address.",
	"system.use_the_requested_format_d01605": "Gamitin ang hinihinging format.",
	"system.use_at_least_count_characters_cba05a": "Gumamit ng hindi bababa sa {count} character.",
	"system.use_no_more_than_count_characters_59bff2": "Gumamit ng hanggang {count} character lamang.",
	"system.enter_a_value_of_at_least_value_c17895": "Maglagay ng halagang hindi bababa sa {value}.",
	"system.enter_a_value_no_greater_than_value_8ae6cd": "Maglagay ng halagang hindi hihigit sa {value}.",
	"system.enter_a_valid_value_b9dff2": "Maglagay ng wastong halaga.",
	"system.count_program_cb3274": "{count} programa",
	"system.count_programs_a766dc": "{count} programa",
	"system.count_subject_47d205": "{count} asignatura",
	"system.count_subjects_f103fc": "{count} asignatura",
	"system.unknown_faculty_e29830": "hindi kilalang guro",
	"system.percent_56b249": "porsiyento",
	"system.rows_52d0b3": "Mga hanay",
	"system.row_9bf7a8": "Hanay",
	"system.this_subject_is_not_assigned_to_you_ask_an_administrator_1b9590": "Hindi nakatalaga sa iyo ang asignaturang ito. Makipag-ugnayan sa administrador.",
	"system.this_was_changed_by_someone_else_reload_to_see_the_latest_bf2233": "Binago ito ng ibang user. Mag-reload upang makita ang pinakabago.",
	"system.nothing_has_changed_since_the_version_you_submitted_make_the_21c5c1": "Walang nabago mula sa bersiyong ipinasa mo. Gawin ang mga pagbabagong hiniling ng tagasuri, pagkatapos ay ipasa muli.",
	"system.tell_the_reviewer_what_you_changed_at_least_a_sentence_befor_31523c": "Sabihin sa tagasuri sa kahit isang pangungusap kung ano ang binago mo bago magpasa muli.",
	"system.this_syllabus_was_submitted_and_is_locked_it_can_be_edited_a_84b2a2": "Naipasa at naka-lock na ang silabus na ito. Mababago lamang ito kapag ibinalik ng administrador para baguhin.",
	"system.this_syllabus_is_status_and_can_no_longer_be_edited_4efd51": "Ang silabus na ito ay {status} at hindi na maaaring baguhin",
	"system.the_administrator_has_not_finished_setting_up_this_subject_y_70e58e": "Hindi pa tapos ang administrador sa pag-set up ng asignaturang ito: kulang ang {gaps}. Makipag-ugnayan sa kanila, pagkatapos ay subukan muli.",
	"system.the_administrator_has_not_finished_setting_up_this_subject_y_8ca34f": "Hindi pa tapos ang administrador sa pag-set up ng asignaturang ito: kulang ang {gaps}. Makipag-ugnayan sa kanila, pagkatapos ay subukan muli.",
	"system.kind_number_is_used_by_subjects_338379": "Ginagamit ng {subjects} ang {kind} {number}",
	"system.remove_those_tags_first_df7fe9": "Alisin muna ang mga ugnayang iyon.",
	"system.no_ai_client_is_configured_d8e253": "Walang naka-configure na AI client.",
	"system.the_ai_reply_was_not_valid_json_98f9a5": "Hindi wastong JSON ang tugon ng AI.",
	"system.the_ai_reply_had_no_list_of_recommendations_018437": "Walang listahan ng rekomendasyon ang tugon ng AI.",
	"system.faculty_compliance_report_1b5c9b": "ULAT SA PAGSUNOD NG MGA GURO",
	"system.generated_8eefdd": "Ginawa noong",
	"system.compliance_rate_0c1dcd": "Antas ng Pagsunod",
	"system.faculty_breakdown_c2a0a2": "DETALYE NG MGA GURO",
	"system.total_total_approved_approved_rate_compliance_209760": "{total} kabuuan, {approved} aprubado, {rate}% pagsunod"
};
Object.assign(extraEn, {
	"programs.heading": "Programs",
	"programs.rename": "Rename",
	"programs.delete": "Delete",
	"programs.renameTitle": "Rename program {code}",
	"programs.deleteTitle": "Delete program {code}",
	"programs.renameNote": "Only the program name changes. Its code, assignments, and saved syllabus versions stay the same.",
	"programs.deleteNote": "Review everything linked to {name} before continuing.",
	"programs.saveName": "Save program name",
	"programs.stage": "Confirmation {step} of 2",
	"programs.loadingImpact": "Loading affected records…",
	"programs.typeCode": "Type {code} to confirm",
	"programs.acknowledge": "I understand this permanently deletes the program, its subjects, and all linked syllabi, including approved versions, comments, messages, and compliance results. This cannot be undone.",
	"programs.reloadImpact": "Review affected records again",
	"programs.continueDelete": "Continue to final confirmation",
	"programs.deleting": "Deleting…",
	"programs.permanentDelete": "Permanently delete program",
	"programs.renamed": "Program name saved.",
	"programs.deleted": "Program and linked records permanently deleted.",
	"programs.deletedPending": "Program deleted. Some uploaded files are awaiting cleanup; the server will retry automatically.",
	"programs.empty": "No programs yet. Add a program with its first subject.",
	"programs.cascadeWarning": "Deleting this program also deletes its subjects and all linked syllabi in every status. Version history, comments, messages, notifications, compliance results, and faculty assignments are removed. Uploaded syllabus files are cleaned up after deletion.",
	"programs.affectedSubjects": "Affected subjects",
	"programs.affectedSyllabi": "Affected syllabi",
	"programs.firstHundred": "The first 100 syllabi are listed. The total above includes all affected syllabi.",
	"programs.count.subjects": "Subjects",
	"programs.count.syllabi": "Syllabi",
	"programs.count.versions": "Saved versions",
	"programs.count.assignments": "Faculty assignments",
	"programs.count.files": "Uploaded files",
	"programs.error.1": "The deletion preview expired or is invalid. Review the program again.",
	"programs.error.2": "Type the program code and acknowledge permanent deletion.",
	"programs.error.3": "The program changed after the preview. Review the affected records again.",
	"programs.error.4": "Only the program name can be changed.",
	"programs.error.5": "Enter a valid program name and reload the current record.",
	"programs.error.6": "This program was changed by someone else. Reload before saving.",
	"programs.error.7": "Another program already uses that name.",
	"programs.error.8": "The catalog changed. Reload and try again.",
	"programs.error.9": "Program management is not set up. Ask an administrator to run the database migration."
});
Object.assign(extraTl, {
	"programs.heading": "Mga Programa",
	"programs.rename": "Palitan ang pangalan",
	"programs.delete": "Burahin",
	"programs.renameTitle": "Palitan ang pangalan ng programang {code}",
	"programs.deleteTitle": "Burahin ang programang {code}",
	"programs.renameNote": "Pangalan lamang ng programa ang magbabago. Mananatili ang kodigo, mga pagtatalaga, at mga naka-save na bersiyon ng silabus.",
	"programs.deleteNote": "Suriin muna ang lahat ng kaugnay ng {name} bago magpatuloy.",
	"programs.saveName": "I-save ang pangalan ng programa",
	"programs.stage": "Pagkumpirma {step} sa 2",
	"programs.loadingImpact": "Kinukuha ang mga maaapektuhang rekord…",
	"programs.typeCode": "I-type ang {code} upang kumpirmahin",
	"programs.acknowledge": "Nauunawaan kong permanenteng mabubura ang programa, mga asignatura nito, at lahat ng kaugnay na silabus, pati mga aprubadong bersiyon, komento, mensahe, at resulta ng pagsusuri. Hindi na ito maibabalik.",
	"programs.reloadImpact": "Suriin muli ang mga maaapektuhang rekord",
	"programs.continueDelete": "Magpatuloy sa huling pagkumpirma",
	"programs.deleting": "Binubura…",
	"programs.permanentDelete": "Permanenteng burahin ang programa",
	"programs.renamed": "Na-save ang pangalan ng programa.",
	"programs.deleted": "Permanenteng nabura ang programa at mga kaugnay na rekord.",
	"programs.deletedPending": "Nabura ang programa. May mga na-upload na file na hinihintay pang maalis; awtomatikong susubukan muli ng server.",
	"programs.empty": "Wala pang programa. Magdagdag ng programa kasama ang unang asignatura nito.",
	"programs.cascadeWarning": "Kapag binura ang programang ito, mabubura rin ang mga asignatura at lahat ng kaugnay na silabus anuman ang katayuan. Maaalis din ang kasaysayan ng bersiyon, mga komento, mensahe, abiso, resulta ng pagsusuri, at pagtatalaga sa guro. Aalisin ang mga na-upload na file ng silabus pagkatapos ng pagbura.",
	"programs.affectedSubjects": "Mga maaapektuhang asignatura",
	"programs.affectedSyllabi": "Mga maaapektuhang silabus",
	"programs.firstHundred": "Nakalista ang unang 100 silabus. Kasama sa kabuuan sa itaas ang lahat ng maaapektuhang silabus.",
	"programs.count.subjects": "Mga Asignatura",
	"programs.count.syllabi": "Mga Silabus",
	"programs.count.versions": "Mga naka-save na bersiyon",
	"programs.count.assignments": "Mga pagtatalaga sa guro",
	"programs.count.files": "Mga na-upload na file",
	"programs.error.1": "Nag-expire o hindi wasto ang paunang pagsusuri sa pagbura. Suriin muli ang programa.",
	"programs.error.2": "I-type ang kodigo ng programa at kumpirmahing nauunawaan ang permanenteng pagbura.",
	"programs.error.3": "Nagbago ang programa matapos ang paunang pagsusuri. Suriin muli ang mga maaapektuhang rekord.",
	"programs.error.4": "Pangalan lamang ng programa ang maaaring baguhin.",
	"programs.error.5": "Maglagay ng wastong pangalan ng programa at i-reload ang kasalukuyang rekord.",
	"programs.error.6": "Binago ng ibang tao ang programang ito. I-reload bago mag-save.",
	"programs.error.7": "Ginagamit na ng ibang programa ang pangalang iyon.",
	"programs.error.8": "Nagbago ang katalogo. I-reload at subukan muli.",
	"programs.error.9": "Hindi pa handa ang pamamahala ng programa. Hilingin sa administrador na patakbuhin ang pag-update ng database."
});
extraEn["programs.error.ambiguousName"] = "A legacy program name is also used by another program. Resolve the conflicting names before deleting.";
extraTl["programs.error.ambiguousName"] = "Ginagamit din ng ibang programa ang dating pangalan ng programang ito. Ayusin muna ang magkaparehong pangalan bago magbura.";
Object.assign(extraEn, {
	"programs.renameNote": "Program codes and names can change. Assignments keep the same program ID, and submitted syllabus versions retain their original content.",
	"programs.saveName": "Save program",
	"programs.renamed": "Program code and name saved.",
	"programs.error.fields": "Only the program code and name can be changed.",
	"programs.error.codeFormat": "Use a program code of 2 to 20 letters, digits or hyphens, starting with a letter.",
	"programs.error.codeDuplicate": "Another program already uses that code.",
	"programs.error.codeReserved": "That program code is reserved by existing records. Choose another code."
});
Object.assign(extraTl, {
	"programs.renameNote": "Maaaring baguhin ang kodigo at pangalan ng programa. Mananatili ang ID ng programa sa mga pagtatalaga, at mapapanatili ang orihinal na nilalaman ng mga naipasang bersiyon ng silabus.",
	"programs.saveName": "I-save ang programa",
	"programs.renamed": "Na-save ang kodigo at pangalan ng programa.",
	"programs.error.fields": "Kodigo at pangalan lamang ng programa ang maaaring baguhin.",
	"programs.error.codeFormat": "Gumamit ng kodigong may 2 hanggang 20 letra, numero o gitling, na nagsisimula sa letra.",
	"programs.error.codeDuplicate": "Ginagamit na ng ibang programa ang kodigong iyon.",
	"programs.error.codeReserved": "Nakalaan ang kodigong iyon para sa mga umiiral na rekord. Pumili ng ibang kodigo."
});
extraEn["repository.approvedSubtitle"] = "Search and access syllabi approved by an administrator.";
extraTl["repository.approvedSubtitle"] = "Maghanap at tingnan ang mga silabus na inaprubahan ng administrador.";
extraEn["outcomes.chooseProgramSubject"] = "Choose a program and subject in Step 1 before creating learning outcomes.";
extraTl["outcomes.chooseProgramSubject"] = "Pumili muna ng programa at asignatura sa Hakbang 1 bago gumawa ng mga kinalabasan ng pagkatuto.";
extraEn["publication.publish"] = "Publish syllabus";
extraTl["publication.publish"] = "Ilathala ang silabus";
extraEn["publication.published"] = "Syllabus published.";
extraTl["publication.published"] = "Nailathala ang silabus.";
extraEn["publication.checkDraft"] = "Check in AI Checker";
extraTl["publication.checkDraft"] = "Suriin sa AI Checker";
extraEn["publication.openChecker"] = "Save and open AI Checker";
extraTl["publication.openChecker"] = "I-save at buksan ang AI Checker";
extraEn["outcomes.subjectSaved"] = "Subject vision and mission saved.";
extraTl["outcomes.subjectSaved"] = "Na-save ang bisyon at misyon ng asignatura.";
extraEn["outcomes.subjectIncomplete"] = "An administrator must complete this subject’s vision, mission, EGAs, POs and CLOs in Program & Subjects before Learning Outcomes can be shown.";
extraTl["outcomes.subjectIncomplete"] = "Kailangang kumpletuhin ng administrador ang bisyon, misyon, EGA, PO at CLO ng asignaturang ito sa Programa at mga Asignatura bago maipakita ang Mga Kinalabasan ng Pagkatuto.";
extraEn["outcomes.setupSaved"] = "Subject outcomes saved.";
extraTl["outcomes.setupSaved"] = "Na-save ang mga kinalabasan ng asignatura.";
extraEn["outcomes.subjectSubtitle"] = "Manage programs, subject details, assignments and deadlines. Faculty write learning outcomes in syllabus builder Step 2.";
extraTl["outcomes.subjectSubtitle"] = "Pamahalaan ang mga programa, detalye ng asignatura, takdang asignatura at takdang petsa. Gagawin ng guro ang mga kinalabasan ng pagkatuto sa Hakbang 2 ng tagabuo ng silabus.";
extraEn["publication.mySubtitle"] = "Manage your drafts and saved syllabi.";
extraTl["publication.mySubtitle"] = "Pamahalaan ang iyong mga burador at naka-save na silabus.";
extraEn["publication.checkerSubtitle"] = "Check submitted syllabi and your own drafts before publication. Results use ";
extraTl["publication.checkerSubtitle"] = "Suriin ang mga naipasang silabus at iyong mga burador bago ilathala. Batay ang mga resulta sa ";
extraEn["publication.error.1"] = "Invalid subject setup section.";
extraTl["publication.error.1"] = "Hindi wastong seksiyon ng pagsasaayos ng asignatura.";
extraEn["publication.error.2"] = "Invalid subject vision or mission.";
extraTl["publication.error.2"] = "Hindi wasto ang bisyon o misyon ng asignatura.";
extraEn["publication.error.3"] = "Invalid subject outcomes.";
extraTl["publication.error.3"] = "Hindi wasto ang mga kinalabasan ng asignatura.";
extraEn["publication.error.4"] = "Invalid subject outcome text.";
extraTl["publication.error.4"] = "Hindi wasto ang teksto ng kinalabasan ng asignatura.";
extraEn["publication.error.5"] = "A subject PO refers to an unknown EGA.";
extraTl["publication.error.5"] = "May PO ng asignatura na tumutukoy sa hindi umiiral na EGA.";
extraEn["publication.error.6"] = "An outcome is still used by this subject. Update its dependent tags first.";
extraTl["publication.error.6"] = "Ginagamit pa ng asignaturang ito ang kinalabasan. Ayusin muna ang mga kaugnay na tag.";
extraEn["publication.error.7"] = "The subject setup changed. Reload before saving its CLOs.";
extraTl["publication.error.7"] = "Nagbago ang pagsasaayos ng asignatura. I-reload bago i-save ang mga CLO nito.";
extraEn["publication.error.8"] = "Administrators publish their own drafts after an AI check.";
extraTl["publication.error.8"] = "Inilalathala ng mga administrador ang sarili nilang burador pagkatapos ng pagsusuri sa AI Checker.";
extraEn["publication.error.9"] = "AI Checker must be set up before publishing.";
extraTl["publication.error.9"] = "Kailangang maihanda ang AI Checker bago makapagpalathala.";
extraEn["publication.error.10"] = "Check the current saved form in AI Checker and wait for the check to finish before publishing.";
extraTl["publication.error.10"] = "Suriin ang kasalukuyang naka-save na form sa AI Checker at hintaying matapos ang pagsusuri bago ilathala.";
extraEn["publication.error.11"] = "Complete the form and check it in AI Checker before publishing your draft.";
extraTl["publication.error.11"] = "Kumpletuhin ang form at suriin ito sa AI Checker bago ilathala ang iyong burador.";
extraEn["publication.error.12"] = "Use the syllabus builder and AI Checker to publish your own syllabus.";
extraTl["publication.error.12"] = "Gamitin ang tagabuo ng silabus at AI Checker upang ilathala ang iyong sariling silabus.";
extraEn["publication.returnDraft"] = "Return to draft";
extraTl["publication.returnDraft"] = "Bumalik sa burador";
extraEn["publication.checkedDrafts"] = "My checked drafts";
extraTl["publication.checkedDrafts"] = "Aking mga nasuring burador";
extraEn["publication.continueToCheck"] = "Save and continue to AI Checker";
extraTl["publication.continueToCheck"] = "I-save at magpatuloy sa AI Checker";
extraEn["publication.approve"] = "Approve & Add to Repository";
extraTl["publication.approve"] = "Aprubahan at idagdag sa Repositoryo";
extraEn["publication.approving"] = "Approving…";
extraTl["publication.approving"] = "Inaaprubahan…";
extraEn["publication.editDraft"] = "Edit Syllabus";
extraTl["publication.editDraft"] = "Baguhin ang Silabus";
extraEn["publication.approvedRepository"] = "Syllabus approved and added to Repository.";
extraTl["publication.approvedRepository"] = "Naaprubahan ang silabus at naidagdag sa Repositoryo.";
extraEn["publication.reviewResult"] = "Review the AI result, then approve the syllabus or edit your draft.";
extraTl["publication.reviewResult"] = "Suriin ang resulta ng AI, pagkatapos ay aprubahan ang silabus o baguhin ang iyong burador.";
extraEn["publication.error.checkReference"] = "Invalid AI check reference.";
extraTl["publication.error.checkReference"] = "Hindi wastong sanggunian ng pagsusuri sa AI.";
extraEn["publication.error.checkChanged"] = "The AI check changed. Open the current result before approving.";
extraTl["publication.error.checkChanged"] = "Nagbago ang pagsusuri sa AI. Buksan ang kasalukuyang resulta bago mag-apruba.";
extraEn["programs.deleteAction"] = "Delete Program";
extraTl["programs.deleteAction"] = "Burahin ang Programa";
extraEn["publication.checkInTab"] = "Review your syllabus here, then save and continue to the AI Checker tab. Approve or edit it after reviewing the results.";
extraTl["publication.checkInTab"] = "Suriin ang iyong silabus dito, pagkatapos ay i-save at magpatuloy sa tab na AI Checker. Aprubahan o baguhin ito matapos suriin ang mga resulta.";
extraEn["publication.reviewSyllabus"] = "Review Syllabus";
extraTl["publication.reviewSyllabus"] = "Suriin ang Silabus";
extraEn["publication.reviewDescription"] = "Review the required fields and syllabus preview before continuing.";
extraTl["publication.reviewDescription"] = "Suriin ang mga kinakailangang field at paunang anyo ng silabus bago magpatuloy.";
extraEn["publication.checkerSubtitle"] = "Check submitted syllabi and completed administrator syllabi awaiting approval. Results use ";
extraTl["publication.checkerSubtitle"] = "Suriin ang mga naipasang silabus at kumpletong silabus ng administrador na naghihintay ng pag-apruba. Batay ang mga resulta sa ";
extraEn["publication.reviewResult"] = "Review the AI result, then approve the syllabus or return it to draft for editing.";
extraTl["publication.reviewResult"] = "Suriin ang resulta ng AI, pagkatapos ay aprubahan ang silabus o ibalik ito sa burador upang baguhin.";
extraEn["publication.error.prepareFirst"] = "Complete the form and send it to AI Checker before approving.";
extraTl["publication.error.prepareFirst"] = "Kumpletuhin ang form at ipadala ito sa AI Checker bago mag-apruba.";
extraEn["publication.error.draftNotCheckable"] = "Drafts stay in My Syllabi. Complete the form and send it to AI Checker first.";
extraTl["publication.error.draftNotCheckable"] = "Mananatili ang mga burador sa Aking mga Silabus. Kumpletuhin muna ang form at ipadala ito sa AI Checker.";
extraEn["publication.error.resumeState"] = "Only a syllabus waiting for an AI decision can return to draft.";
extraTl["publication.error.resumeState"] = "Ang silabus lamang na naghihintay ng pasya matapos ang pagsusuri sa AI ang maaaring ibalik sa burador.";
extraEn["publication.error.size"] = "This syllabus is too large to save.";
extraTl["publication.error.size"] = "Masyadong malaki ang silabus na ito upang mai-save.";
extraEn["history.savedRevisions"] = "Saved versions are preserved and never overwritten by later edits.";
extraTl["history.savedRevisions"] = "Pinapanatili ang mga na-save na bersyon at hindi pinapatungan ng mga susunod na pagbabago.";
extraEn["chat.ownAdminUnavailable"] = "Messaging is unavailable for your own administrator-created syllabus.";
extraTl["chat.ownAdminUnavailable"] = "Hindi magagamit ang pagmemensahe para sa sarili mong silabus na ginawa bilang administrador.";
extraEn["dashboard.admin.programsNote"] = "In the catalog";
extraTl["dashboard.admin.programsNote"] = "Nasa katalogo";
extraEn["dashboard.admin.subjectsNote"] = "Across all programs";
extraTl["dashboard.admin.subjectsNote"] = "Sa lahat ng programa";
extraEn["dashboard.usage.title"] = "Time Usage";
extraEn["dashboard.goodMorning"] = "Good morning, {name}!";
extraTl["dashboard.goodMorning"] = "Magandang umaga, {name}!";
extraEn["dashboard.goodMorningNoName"] = "Good morning!";
extraTl["dashboard.goodMorningNoName"] = "Magandang umaga!";
extraEn["dashboard.goodAfternoon"] = "Good afternoon, {name}!";
extraTl["dashboard.goodAfternoon"] = "Magandang hapon, {name}!";
extraEn["dashboard.goodAfternoonNoName"] = "Good afternoon!";
extraTl["dashboard.goodAfternoonNoName"] = "Magandang hapon!";
extraEn["dashboard.goodEvening"] = "Good evening, {name}!";
extraTl["dashboard.goodEvening"] = "Magandang gabi, {name}!";
extraEn["dashboard.goodEveningNoName"] = "Good evening!";
extraTl["dashboard.goodEveningNoName"] = "Magandang gabi!";
extraEn["outcomes.authoringNote"] = "Create the Vision, Mission, EGA, PO and CLO for this syllabus. Changes save automatically.";
extraEn["outcomes.saveInvalid"] = "Invalid learning outcomes. Check the fields and outcome mappings in step 2.";
extraTl["outcomes.saveInvalid"] = "Hindi wasto ang mga kinalabasan ng pagkatuto. Suriin ang mga field at pagmamapa sa hakbang 2.";
extraEn["outcomes.submitIncomplete"] = "Complete Vision, Mission, EGA, PO and CLO in step 2 before submitting.";
extraTl["outcomes.submitIncomplete"] = "Kumpletuhin ang Vision, Mission, EGA, PO at CLO sa hakbang 2 bago isumite.";
extraEn["outcomes.changeLabel"] = "Learning outcomes";
extraTl["outcomes.changeLabel"] = "Mga kinalabasan ng pagkatuto";
extraTl["outcomes.authoringNote"] = "Gawin ang Vision, Mission, EGA, PO at CLO para sa silabus na ito. Awtomatikong nase-save ang mga pagbabago.";
extraEn["outcomes.inUse"] = "Remove the dependent outcome mappings first.";
extraTl["outcomes.inUse"] = "Alisin muna ang mga pagmamapang gumagamit ng kinalabasang ito.";
extraEn["outcomes.authorInStep2"] = "Create your learning outcomes in step 2.";
extraTl["outcomes.authorInStep2"] = "Gawin ang iyong mga kinalabasan ng pagkatuto sa hakbang 2.";
extraEn["outcomes.subjectIdentity"] = "The subject supplies the course code and title. Learning outcomes are edited in step 2.";
extraTl["outcomes.subjectIdentity"] = "Mula sa asignatura ang code at pamagat ng kurso. Baguhin ang mga kinalabasan ng pagkatuto sa hakbang 2.";
extraEn["outcomes.subjectCreated"] = "Subject added. Faculty create its syllabus learning outcomes in step 2.";
extraTl["outcomes.subjectCreated"] = "Naidagdag ang asignatura. Gagawin ng guro ang mga kinalabasan ng pagkatuto ng silabus sa hakbang 2.";
extraEn["outcomes.changeSubject"] = "Changing the subject replaces this syllabus’s learning outcomes with the selected subject’s starting values. Continue?";
extraTl["outcomes.changeSubject"] = "Papalitan ng pagbabago ng asignatura ang mga kinalabasan ng pagkatuto sa silabus ng panimulang datos ng napiling asignatura. Magpatuloy?";
extraEn["outcomes.visionRequired"] = "Add the vision in step 2.";
extraTl["outcomes.visionRequired"] = "Ilagay ang bisyon sa hakbang 2.";
extraEn["outcomes.missionRequired"] = "Complete the mission in step 2.";
extraTl["outcomes.missionRequired"] = "Kumpletuhin ang misyon sa hakbang 2.";
extraEn["outcomes.egasRequired"] = "Complete the EGA names and short names in step 2.";
extraTl["outcomes.egasRequired"] = "Kumpletuhin ang mga pangalan at maikling pangalan ng EGA sa hakbang 2.";
extraEn["outcomes.posRequired"] = "Complete the PO statements and short names in step 2.";
extraTl["outcomes.posRequired"] = "Kumpletuhin ang mga pahayag at maikling pangalan ng PO sa hakbang 2.";
extraEn["outcomes.closRequired"] = "Complete the CLO statements and EGA and PO mappings in step 2.";
extraTl["outcomes.closRequired"] = "Kumpletuhin ang mga pahayag ng CLO at pagmamapa ng EGA at PO sa hakbang 2.";
extraEn["outcomes.mappingsRequired"] = "Fix the outcome mappings in step 2.";
extraTl["outcomes.mappingsRequired"] = "Ayusin ang pagmamapa ng mga kinalabasan sa hakbang 2.";
extraEn["dashboard.usage.selectDay"] = "Hover over a bar to see total usage in hours and minutes.";
extraTl["dashboard.usage.selectDay"] = "Itapat ang pointer sa bar upang makita ang kabuuang oras at minuto ng paggamit.";
extraTl["dashboard.usage.title"] = "Oras ng Paggamit";
extraEn["dashboard.usage.today"] = "Active today";
extraTl["dashboard.usage.today"] = "Aktibo ngayon";
extraEn["dashboard.usage.avgDay"] = "Average per active day";
extraTl["dashboard.usage.avgDay"] = "Karaniwan bawat aktibong araw";
extraEn["dashboard.usage.avgSession"] = "Average session";
extraTl["dashboard.usage.avgSession"] = "Karaniwang sesyon";
extraEn["dashboard.usage.activeDays"] = "Active days";
extraTl["dashboard.usage.activeDays"] = "Mga aktibong araw";
extraEn["dashboard.usage.activeDaysValue"] = "{active} of {total}";
extraTl["dashboard.usage.activeDaysValue"] = "{active} sa {total}";
extraEn["dashboard.usage.busiest"] = "Busiest day";
extraTl["dashboard.usage.busiest"] = "Pinakaabalang araw";
extraEn["dashboard.usage.range"] = "Time range";
extraTl["dashboard.usage.range"] = "Saklaw ng panahon";
extraEn["dashboard.usage.range7"] = "7 days";
extraTl["dashboard.usage.range7"] = "7 araw";
extraEn["dashboard.usage.range30"] = "30 days";
extraTl["dashboard.usage.range30"] = "30 araw";
extraEn["dashboard.usage.note"] = "Counts only while this tab is open and you are active.";
extraTl["dashboard.usage.note"] = "Binibilang lamang habang bukas ang tab na ito at aktibo ka.";
extraEn["dashboard.usage.empty"] = "Your active time will appear here as you use the system.";
extraTl["dashboard.usage.empty"] = "Lalabas dito ang iyong aktibong oras habang ginagamit mo ang sistema.";
extraEn["dashboard.usage.off"] = "Time tracking is not set up yet.";
extraTl["dashboard.usage.off"] = "Hindi pa naka-set up ang pagsubaybay ng oras.";
extraEn["dashboard.usage.error"] = "Could not load your time usage.";
extraTl["dashboard.usage.error"] = "Hindi ma-load ang iyong paggamit ng oras.";
extraEn["dashboard.usage.retry"] = "Try again";
extraTl["dashboard.usage.retry"] = "Subukan muli";
extraEn["dashboard.usage.chartLabel"] = "Active time per day. {summary}";
extraTl["dashboard.usage.chartLabel"] = "Aktibong oras bawat araw. {summary}";
extraEn["dashboard.usage.loading"] = "Loading your time usage";
extraTl["dashboard.usage.loading"] = "Nilo-load ang iyong paggamit ng oras";
extraEn["select.typeToFilter"] = "Type to filter";
extraTl["select.typeToFilter"] = "Mag-type para mag-filter";
extraEn["select.filtering"] = "Filter: {query}";
extraTl["select.filtering"] = "Salain: {query}";
extraEn["select.noMatches"] = "No matches";
extraTl["select.noMatches"] = "Walang tugma";
extraEn["subjects.byProgram"] = "Subjects by program";
extraTl["subjects.byProgram"] = "Mga asignatura ayon sa programa";
extraEn["subjects.edit"] = "Edit";
extraTl["subjects.edit"] = "I-edit";
extraEn["subjects.delete"] = "Delete";
extraTl["subjects.delete"] = "Burahin";
extraEn["subjects.editTitle"] = "Edit subject {code}";
extraTl["subjects.editTitle"] = "I-edit ang asignaturang {code}";
extraEn["subjects.deleteTitle"] = "Delete subject {code}";
extraTl["subjects.deleteTitle"] = "Burahin ang asignaturang {code}";
extraEn["subjects.editNote"] = "Change the subject code and title. Its outcomes and syllabi stay as they are.";
extraTl["subjects.editNote"] = "Baguhin ang kodigo at pamagat ng asignatura. Mananatili ang mga kinalabasan at silabus nito.";
extraEn["subjects.deleteNote"] = "{code} will be removed. Syllabi that use it keep the outcomes they were saved with, but new drafts can no longer pick it.";
extraTl["subjects.deleteNote"] = "Aalisin ang {code}. Pananatilihin ng mga silabus na gumagamit nito ang mga kinalabasang naka-save sa kanila, ngunit hindi na ito mapipili ng mga bagong draft.";
extraEn["subjects.deleteAction"] = "Delete subject";
extraTl["subjects.deleteAction"] = "Burahin ang asignatura";
extraEn["subjects.deleting"] = "Deleting…";
extraTl["subjects.deleting"] = "Binubura…";
for (const [key, [en, tl]] of Object.entries({
	"deadline.column": ["Deadline", "Takdang petsa"],
	"deadline.set": ["Set deadline", "Magtakda ng petsa"],
	"deadline.chipProgress": ["{done} of {total} submitted", "{done} sa {total} ang nakapagpasa"],
	"assignments.heldBy": ["Assigned to {name}", "Nakatalaga kay {name}"],
	"deadline.chipNobody": ["No faculty assigned", "Walang nakatalagang guro"],
	"deadline.chipSettled": ["Settled", "Naayos na"],
	"deadline.settledNote": ["Settled: every assigned faculty member has submitted, so nothing is left to wait for. It reopens by itself if someone else is assigned to this subject.", "Naayos na: nakapagpasa na ang lahat ng nakatalagang guro, kaya wala nang hinihintay. Awtomatiko itong magbubukas muli kung may ibang itatalaga sa subject na ito."],
	"deadline.chipLabel": ["Deadline for {code}: {summary}", "Takdang petsa para sa {code}: {summary}"],
	"deadline.chipSet": ["Set a deadline for {code}", "Magtakda ng petsa para sa {code}"],
	"deadline.dialogTitle": ["Deadline for {code}", "Takdang petsa para sa {code}"],
	"deadline.dialogNote": ["Every faculty member assigned to this subject must submit a syllabus by this date. Late submissions are still accepted and marked late.", "Dapat magpasa ng silabus ang bawat gurong nakatalaga sa asignaturang ito bago ang petsang ito. Tinatanggap pa rin ang huling pagpasa at namamarkahang huli."],
	"deadline.term": ["Term", "Termino"],
	"deadline.newTerm": ["New term", "Bagong termino"],
	"deadline.schoolYear": ["School year", "Taong panuruan"],
	"deadline.semester": ["Semester", "Semestre"],
	"deadline.sem.first": ["1st Semester", "Unang Semestre"],
	"deadline.sem.second": ["2nd Semester", "Ikalawang Semestre"],
	"deadline.sem.summer": ["Summer", "Tag-init"],
	"deadline.dueAt": ["Due date and time (Philippine Time)", "Takdang petsa at oras (Oras sa Pilipinas)"],
	"deadline.instructions": ["Instructions for faculty (optional)", "Mga tagubilin para sa mga guro (opsyonal)"],
	"deadline.advanced": ["Advanced", "Karagdagang opsyon"],
	"deadline.opensAt": ["Count submissions made from", "Bilangin ang mga pagpasang ginawa mula"],
	"deadline.opensHint": ["A submission made before this date does not count toward this deadline.", "Hindi binibilang sa takdang petsang ito ang pagpasang ginawa bago ang petsang ito."],
	"deadline.save": ["Save deadline", "I-save ang takdang petsa"],
	"deadline.saved": ["Deadline saved.", "Na-save ang takdang petsa."],
	"deadline.cancelDeadline": ["Cancel deadline", "Kanselahin ang takdang petsa"],
	"deadline.cancelConfirm": ["Click again to cancel this deadline", "I-click muli para kanselahin ang takdang petsa"],
	"deadline.cancelled": ["Deadline cancelled.", "Nakansela ang takdang petsa."],
	"deadline.close": ["Close", "Isara"],
	"deadline.progress": ["Faculty progress", "Pag-usad ng mga guro"],
	"deadline.stat.submitted": ["On time", "Sa oras"],
	"deadline.stat.late": ["Late", "Huli"],
	"deadline.stat.waiting": ["Waiting", "Naghihintay"],
	"deadline.stat.failed": ["Failed", "Hindi nakapagpasa"],
	"deadline.unassigned": ["No faculty member is assigned to this subject yet. Assign one in Users and Roles; they will then have this deadline.", "Wala pang gurong nakatalaga sa asignaturang ito. Magtalaga sa Users and Roles; magkakaroon na sila ng takdang petsang ito."],
	"deadline.submittedOn": ["Submitted {date}", "Naipasa noong {date}"],
	"deadline.notSubmitted": ["Not submitted yet", "Hindi pa naipasa"],
	"deadline.loading": ["Loading progress", "Nilo-load ang pag-usad"],
	"deadline.loadError": ["Could not load the progress.", "Hindi ma-load ang pag-usad."],
	"deadline.status.upcoming": ["Upcoming", "Paparating"],
	"deadline.status.due_today": ["Due today", "Takdang petsa ngayon"],
	"deadline.status.failed": ["Failed to submit", "Hindi nakapagpasa"],
	"deadline.status.submitted": ["Submitted", "Naipasa"],
	"deadline.status.submitted_late": ["Submitted late", "Naipasa nang huli"]
})) {
	extraEn[key] = en;
	extraTl[key] = tl;
}
extraEn["deadline.invalidDue"] = "Enter a valid due date and time.";
extraTl["deadline.invalidDue"] = "Maglagay ng wastong takdang petsa at oras.";
extraEn["deadline.notSetUp"] = "Deadlines are not set up yet. Ask the administrator to run the database migration.";
extraTl["deadline.notSetUp"] = "Hindi pa naka-set up ang mga takdang petsa. Ipatakbo sa administrator ang database migration.";
for (const [key, [en, tl]] of Object.entries({
	"deadline.dueOn": ["Due {date}", "Takdang petsa: {date}"],
	"deadline.failedCount": ["{count} failed", "{count} ang hindi nakapagpasa"],
	"deadline.cardOff": ["Deadlines are not set up yet.", "Hindi pa naka-set up ang mga takdang petsa."],
	"deadline.cardEmptyFaculty": ["No deadlines for your subjects yet.", "Wala pang takdang petsa para sa iyong mga asignatura."],
	"deadline.cardEmptyAdmin": ["No deadlines set yet. Set one from Programs and Subjects.", "Wala pang takdang petsa. Magtakda mula sa Programs and Subjects."]
})) {
	extraEn[key] = en;
	extraTl[key] = tl;
}
for (const [key, [en, tl]] of Object.entries({
	"deadline.remind": ["Remind", "Paalalahanan"],
	"deadline.remindAll": ["Reminder", "Paalala"],
	"deadline.remindLabel": ["Remind {name}", "Paalalahanan si {name}"],
	"deadline.lastReminded": ["Reminded {date}", "Napaalalahanan noong {date}"],
	"deadline.remindDone": ["Reminded {sent} by notification and {emailed} by email.", "{sent} ang naabisuhan sa notification at {emailed} sa email."],
	"deadline.remindSkipped": ["{count} skipped: already submitted, or reminded in the last 6 hours.", "{count} ang nilaktawan: naipasa na, o napaalalahanan sa nakalipas na 6 na oras."],
	"deadline.toastSentOne": ["Reminder sent to {name}.", "Naipadala na ang paalala kay {name}."],
	"deadline.toastSent": ["Reminder sent to {count} faculty.", "Naipadala na ang paalala sa {count} guro."],
	"deadline.toastCooling": ["Already reminded recently. Try again later.", "Napaalalahanan na kamakailan. Subukan muli mamaya."],
	"deadline.toastSubmitted": ["Already submitted, so no reminder was sent.", "Naipasa na, kaya walang ipinadalang paalala."],
	"deadline.remindNobody": ["Nobody needs a reminder right now.", "Walang kailangang paalalahanan ngayon."],
	"deadline.remindFailed": ["Could not send the reminder.", "Hindi maipadala ang paalala."],
	"deadline.savedNotified": ["Deadline saved. {count} faculty notified.", "Na-save ang takdang petsa. {count} guro ang naabisuhan."],
	"deadline.cancelledNotified": ["Deadline cancelled. {count} faculty notified.", "Nakansela ang takdang petsa. {count} guro ang naabisuhan."]
})) {
	extraEn[key] = en;
	extraTl[key] = tl;
}
for (const [key, [en, tl]] of Object.entries({
	"date.choose": ["Select date", "Pumili ng petsa"],
	"date.chooseDateTime": ["Select date and time", "Pumili ng petsa at oras"],
	"date.prevMonth": ["Previous month", "Nakaraang buwan"],
	"date.nextMonth": ["Next month", "Susunod na buwan"],
	"date.today": ["Today", "Ngayon"],
	"date.clear": ["Clear", "Burahin"],
	"date.done": ["Done", "Tapos na"],
	"date.time": ["Time", "Oras"],
	"review.rejectHint": ["Sent back; it can still be edited", "Ibabalik; maaari pa itong baguhin"],
	"review.rejectConfirm": ["Reject this syllabus? The faculty member is told why and can edit and submit it again.", "I-reject ang silabus na ito? Sasabihin sa guro kung bakit at maaari niya itong baguhin at ipasa muli."],
	"builder.rejectedTitle": ["Rejected: edit and submit again. ", "Na-reject: baguhin at ipasa muli. "],
	"builder.openMySyllabi": ["Open My Syllabi", "Buksan ang My Syllabi"],
	"builder.subjectTaken": ["you already have a syllabus ({status})", "may silabus ka na ({status})"],
	"builder.subjectHasDraft": ["you already have a draft", "may draft ka na"],
	"syllabi.showArchived": ["Show archived ({count})", "Ipakita ang naka-archive ({count})"],
	"syllabi.archivedTag": ["Archived", "Naka-archive"],
	"builder.saveAsDraft": ["Save as draft", "I-save bilang draft"],
	"builder.draftSaved": ["Draft saved. You can continue it from My Syllabi.", "Na-save ang draft. Maaari mo itong ipagpatuloy sa My Syllabi."]
})) {
	extraEn[key] = en;
	extraTl[key] = tl;
}
for (const [key, [en, tl]] of Object.entries({
	"plan.heading.ilo": ["Intended Learning Outcomes (ILO)", "Mga Inaasahang Kinalabasan ng Pagkatuto (ILO)"],
	"plan.heading.contents": ["Course Contents", "Nilalaman ng Kurso"],
	"plan.heading.activities": ["Suggested Learning Activities", "Mga Iminumungkahing Gawain sa Pagkatuto"],
	"plan.heading.tasks": ["Suggested Assessment Tasks", "Mga Iminumungkahing Gawain sa Pagtatasa"],
	"plan.heading.values": ["Expected Value/s To Be Integrated", "Inaasahang Pagpapahalaga na Isasama"]
})) {
	extraEn[key] = en;
	extraTl[key] = tl;
}
//#endregion
//#region src/i18n/hybrid.js
const hybridEn = {
	"hybrid.refine": "Check & improve",
	"hybrid.refining": "Checking…",
	"hybrid.applyVerified": "Apply verified rewrite",
	"hybrid.refineOk": "Checked against {checked} related items: {improved} improve and none get worse. It is safe to accept.",
	"hybrid.refineRewritten": "The first draft would have made another item worse, so a new rewrite was written and checked against {checked} related items: {improved} improve and none get worse. It is in the box above.",
	"hybrid.refineBlocked": "No rewrite satisfied every related item: {worse} of {checked} would get worse. You can edit the text yourself, or accept it knowing the trade-off.",
	"hybrid.refineBlockers": "What stands in the way",
	"hybrid.refineFailed": "The recommendation could not be checked.",
	"hybrid.label.ALIGNED": "Aligned",
	"hybrid.refreshSuggestions": "These recommendations are from an older checker version. Click Re-Check again to generate recommendations that can safely update this draft.",
	"hybrid.suggestionTargetChanged": "This field or row has changed since the recommendation was generated. Keep your edits or click Re-Check again for an updated recommendation.",
	"hybrid.suggestionSaveFailed": "The recommended change could not be saved. Your draft remains open; retry after resolving the save error.",
	"hybrid.savedDecisionFailed": "The draft was saved, but its recommendation decision could not be recorded: {message}",
	"hybrid.appliedSaved": "Applied and saved",
	"hybrid.decision.accept": "Accepted",
	"hybrid.decision.edit": "Edited",
	"hybrid.decision.reject": "Rejected",
	"hybrid.aiCheck": "AI CHECK",
	"hybrid.handled": "Applied recommendations ({count})",
	"hybrid.allHandled": "All recommendations are applied. Click Re-Check again to refresh the score.",
	"hybrid.noDraftTitle": "Problems with no draft to accept ({count})",
	"hybrid.unlinkedNote": "{count} of these have no draft recommendation. Open the details to see what to fix by hand. The rest are explained on their recommendation below.",
	"hybrid.allLinked": "Each of these is explained on the recommendation below that fixes it.",
	"hybrid.fixes": "Why this is suggested: fixes {count}",
	"hybrid.reused": "Reused {reused} earlier judgements · asked the AI about {asked}",
	"hybrid.reusedHint": "Relationships whose text did not change since the last check keep their earlier verified judgement, so only what changed was sent to the AI.",
	"hybrid.readOnlyNote": "Only the author can accept or change these. They see them in their own Review and Check step, and the administrator and the author both see which ones were applied.",
	"hybrid.suggestedText": "Suggested text",
	"hybrid.appliedByAuthor": "Applied by the author",
	"hybrid.rejectedByAuthor": "Rejected by the author",
	"activity.check": "ran an AI check on",
	"activity.recommend": "answered a recommendation on",
	"activity.accepted": "accepted a recommendation on",
	"activity.edited": "edited and applied a recommendation on",
	"activity.rejected": "rejected a recommendation on",
	"hybrid.advisory": "Reference · advice only",
	"hybrid.viewDetails": "View details",
	"hybrid.closeProblems": "Close",
	"hybrid.count.high": "{count} serious",
	"hybrid.count.medium": "{count} to improve",
	"hybrid.undo": "Undo change",
	"hybrid.cannotUndo": "This change cannot be undone automatically because the original text was not recorded. Edit the field by hand.",
	"hybrid.checkButton": "AI Checker",
	"hybrid.recheckButton": "Re-Check again",
	"hybrid.checkDetails": "View check details",
	"hybrid.codedEvidence": "Coded rule evidence ({count} checks)",
	"hybrid.policy": "Scoring policy: {version}",
	"hybrid.check.PASS": "Pass",
	"hybrid.check.FAIL": "Fail",
	"hybrid.check.NOT_EVALUATED": "Not evaluated",
	"hybrid.check.NOT_APPLICABLE": "Not applicable",
	"hybrid.actual": "Submitted or observed value",
	"hybrid.expected": "Required value",
	"hybrid.label": "Hybrid syllabus verification",
	"hybrid.alignment": "AI alignment: {status}",
	"hybrid.model": "Model: {model}",
	"hybrid.status.completed": "completed",
	"hybrid.status.not_evaluated": "not evaluated",
	"hybrid.notScored": "not scored",
	"hybrid.scores": "Coded baseline: {base}%. Deductions: {deductions} points. Final verified score: {score}.",
	"hybrid.unavailableScore": "Unavailable",
	"hybrid.incomplete": "Verification incomplete",
	"hybrid.incompleteNote": "Verification incomplete. No final AI score is available.",
	"hybrid.codedAreas": "Coded checks below measure form completeness and coverage, not AI semantic alignment.",
	"hybrid.locked": "Submission is locked until official curriculum, institutional text, structural rules, reference verification and active AI alignment checks are complete.",
	"hybrid.evidence": "AI alignment evidence ({count} relationships)",
	"hybrid.bloom": "Bloom level: {source} → {target}",
	"hybrid.source": "Source: “{quote}”",
	"hybrid.target": "Target: “{quote}”",
	"hybrid.deductions": "Score deductions",
	"hybrid.points": "{reason}: −{points} points ({id})",
	"hybrid.recommendation": "AI Recommendation ({count})",
	"hybrid.recommendations": "AI Recommendations ({count})",
	"hybrid.applyNote": "Accept applies and saves the displayed recommendation. Edit and apply saves your revision. You can accept other recommendations whose target fields are unchanged. Click Re-Check again when ready for a new score.",
	"hybrid.attachNote": "Accept or Edit records a draft recommendation for the author. It does not change their syllabus.",
	"hybrid.editText": "Edit proposed text",
	"hybrid.editLabel": "Edit recommendation {id}",
	"hybrid.accept": "Accept",
	"hybrid.editApply": "Edit and apply",
	"hybrid.editSave": "Save edited draft",
	"hybrid.reject": "Reject",
	"hybrid.unavailable": "Hybrid checks are unavailable. Submission remains locked until the checker is set up.",
	"hybrid.required": "Complete active AI alignment and all hard gates on this saved form first.",
	"hybrid.submitVersion": "Submit new version to Admin",
	"hybrid.submit": "Submit to Admin",
	"hybrid.curriculumYear": "Curriculum year",
	"hybrid.yearExample": "For example, 2022-2023",
	"hybrid.yearLevel": "Year level",
	"hybrid.changed": "The form changed. Re-check before applying a recommendation.",
	"hybrid.recheckBanner": "The syllabus changed after this check. Click Re-Check again to re-check its alignment before submitting.",
	"hybrid.applying": "Applying…",
	"hybrid.applyFailed": "The change could not be applied. Nothing in the syllabus was changed.",
	"hybrid.cardStale": "This recommendation cannot be applied: it came from an older check. Click Re-Check again for a fresh one.",
	"hybrid.cardApplied": "{what} updated in the syllabus and saved. Re-check to refresh the score.",
	"hybrid.problemsShort": "{count} to fix",
	"hybrid.recsShort": "{count} recommendations",
	"hybrid.scoreBase": "Coded baseline",
	"hybrid.scoreDeducted": "Deductions",
	"hybrid.scoreFinal": "Verified score",
	"hybrid.lockedTitle": "Submission is locked",
	"hybrid.problems": "What needs attention ({count})",
	"hybrid.sev.high": "Most serious",
	"hybrid.sev.medium": "Worth improving",
	"hybrid.hardGateRequired": "Fix the required rules in the Review step before submitting.",
	"hybrid.hardGateTitle": "These required rules must pass before you can submit",
	"hybrid.hardGateText": "They come from the official curriculum and the standard form, not from the AI.",
	"hybrid.qualityTitle": "Quality notes ({count})",
	"hybrid.qualityNote": "Advice only. These notes come from the syllabus text itself. They do not change the score or stop a submit, and you decide whether any applies.",
	"hybrid.qualityAction": "You could:",
	"hybrid.quality.outcome_quality": "Learning outcomes",
	"hybrid.quality.learning_progression": "Learning progression",
	"hybrid.quality.assessment_quality": "Assessment",
	"hybrid.quality.coverage": "Coverage",
	"hybrid.quality.workload": "Workload",
	"hybrid.quality.accessibility": "Access",
	"hybrid.summary.no_changes_needed": "No further changes are needed. The required checks pass and nothing material remains.",
	"hybrid.summary.optionalAvailable": "{count} optional suggestions are available if you want them.",
	"hybrid.summary.material_open": "{count} specific problems still need attention.",
	"hybrid.summary.mandatory_open": "A required rule still fails. It must be fixed before this can be submitted.",
	"hybrid.summary.incomplete": "The AI check did not finish, so it cannot say yet whether changes are needed.",
	"hybrid.regressedNote": "Your earlier change to {path} fixed its original problem but made another relationship fail.",
	"hybrid.tier.mandatory": "Required",
	"hybrid.tier.material": "Needs attention",
	"hybrid.tier.optional": "Optional",
	"hybrid.attempt": "Attempt {n} of {max}",
	"hybrid.unresolvedTitle": "Needs your decision ({count})",
	"hybrid.unresolvedNote": "The checker could not find a rewrite that fixes these, so it stopped instead of offering more wordings. They still count in the score.",
	"hybrid.unresolved.no_change_proposed": "The only rewrite it could offer changed nothing, so there is nothing to apply.",
	"hybrid.unresolved.attempt_limit": "It has already offered {attempts} rewrites for this and the problem remains.",
	"hybrid.refineNoChange": "The proposed text does not change the field in any way that matters, so there is nothing to apply.",
	"hybrid.provisional": "Provisional",
	"hybrid.provisionalAria": "Provisional score {score} percent. The check is not finished.",
	"hybrid.provisionalCoverage": "Provisional score: {verified} of {total} relationships were checked. Run the check again to finish it and get the final score. The recommendations below are for what was checked.",
	"hybrid.provisionalPlain": "Provisional score. Run the check again to get the final score. The recommendations below are for what was checked.",
	"hybrid.provisionalRule": "Provisional score. A required rule must also pass before it becomes final. The recommendations below are for what was checked.",
	"hybrid.adviceTitle": "The AI check is advice",
	"hybrid.adviceText": "You decide what to improve. You can submit without applying the recommendations, and the reviewer will see this result.",
	"hybrid.advisoryIncomplete": "The AI check is incomplete, so there is no final AI score yet. You can still submit.",
	"hybrid.label.INSUFFICIENT_EVIDENCE": "Could not verify",
	"hybrid.label.NOT_ALIGNED": "Not aligned",
	"hybrid.label.PARTIALLY_ALIGNED": "Partly aligned",
	"hybrid.pts": "−{points} points",
	"hybrid.where": "In {where}",
	"hybrid.quoteSource": "From the syllabus",
	"hybrid.quoteTarget": "Compared with",
	"hybrid.noProblems": "No problems found. Every checked relationship is aligned.",
	"hybrid.kind.clo": "Course learning outcome",
	"hybrid.kind.ilo": "Lesson outcome",
	"hybrid.kind.plan": "Learning plan",
	"hybrid.kind.outcomes": "Institution outcomes",
	"hybrid.kind.meta": "Course details",
	"hybrid.kind.other": "Draft",
	"verdict.title": "Academic verdict (advisory)",
	"verdict.note": "Advisory view. It does not change the official score or block a submit. A complete syllabus is not the same as an aligned one.",
	"verdict.completeness": "Completeness",
	"verdict.completenessNone": "Not scored",
	"verdict.curriculum": "Curriculum",
	"verdict.alignment": "Academic alignment",
	"verdict.overall": "Overall",
	"verdict.status.PASS": "Pass",
	"verdict.status.FAIL": "Fail",
	"verdict.status.NEEDS_REVIEW": "Needs review",
	"verdict.status.NOT_CHECKED": "Not checked",
	"verdict.status.NOT_APPLICABLE": "Not applicable",
	"verdict.overall.COMPLIANT": "Compliant on what was checked",
	"verdict.overall.NOT_COMPLIANT": "Not compliant",
	"verdict.overall.NEEDS_REVIEW": "Needs review",
	"verdict.overall.PARTIAL_VALIDATION": "Partly validated",
	"verdict.method.deterministic": "Fixed rule",
	"verdict.method.course_profile": "Course reference",
	"verdict.method.ai_semantic": "AI review",
	"verdict.partial": "{count} checks could not be made and are not counted as passed.",
	"verdict.issues": "Findings",
	"verdict.unverified": "Not checked",
	"verdict.week": "Week {week}",
	"verdict.original": "Current text",
	"verdict.suggestion": "Suggested rewrite (unverified; needs your approval)",
	"verdict.review.explanationTitle": "Explanation needs faculty review",
	"verdict.review.explanationNote": "These heuristic warnings do not change the academic judgment. Verified quotes do not verify the reasoning around them.",
	"verdict.review.draftTitle": "Draft needs faculty review",
	"verdict.review.draftNote": "The draft is withheld. These heuristic warnings identify possible unsupported wording; the faculty-authored text is preserved.",
	"verdict.review.draftWarningTitle": "Advisory draft caution",
	"verdict.review.draftWarningNote": "This caution alone does not withhold the draft or change the academic judgment. Similar wording does not prove an unsuitable correction; confirm the proposal before using it.",
	"verdict.review.phrase": "Flagged wording: “{phrase}”.",
	"verdict.review.code.explanation_from_other_pair": "The explanation may use wording from another relationship seen by the AI.",
	"verdict.review.code.cites_other_week": "The explanation names a week outside this lesson.",
	"verdict.review.code.venue_claim": "A claim about the publisher, journal or source is not stated in the reference entry.",
	"verdict.review.code.metadata_claim": "A claim about the source metadata or standing is not established by the supplied text.",
	"verdict.review.code.basis_overstated": "The named venue may not support the stated evidence basis.",
	"verdict.review.code.basis_contradicts_relevance": "The evidence basis and definite relevance judgment need to be read together.",
	"verdict.review.code.copies_other_relationship": "The draft may copy wording from another relationship seen by the AI.",
	"verdict.review.code.adds_participant": "The draft introduces participants not established in this lesson.",
	"verdict.review.code.adds_activity": "The draft introduces an activity not established in this lesson.",
	"verdict.review.code.adds_resource": "The draft introduces resources not established in this lesson.",
	"verdict.review.code.adds_week": "The draft introduces timing not established in this lesson.",
	"verdict.review.code.value_not_expressed": "The draft may attach the value name to a technical step without showing how the value is expressed.",
	"verdict.review.code.copies_reference": "The draft largely copies the reference wording.",
	"verdict.review.code.keeps_off_subject": "The draft keeps much of the wording judged off the course subject.",
	"verdict.review.code.unnecessary_practical": "The draft may add practical work that the conceptual ILO does not require.",
	"verdict.review.code.expands_competency": "The draft may expand the required competency beyond this lesson’s ILO.",
	"verdict.review.code.assumes_resource": "The draft may assume equipment, software, facilities or resources whose availability is not established.",
	"verdict.review.code.borrowed_wording": "The draft shares wording with another relationship, but this does not establish that the proposal is unsuitable.",
	"verdict.review.code.conditional_resource": "The draft makes resource use conditional. Faculty still need to confirm availability and feasibility.",
	"verdict.review.code.proposed_resource": "The draft proposes preparing or providing instructional materials. Faculty must confirm that they can create and supply them; their current availability is not established.",
	"verdict.review.code.resource_needs_confirmation": "The reference to instructional materials is ambiguous. Faculty should confirm whether these materials exist or are being proposed; this caution alone does not withhold the draft.",
	"verdict.review.code.practical_requirement": "The explanation may infer a practical requirement from course context rather than this ILO’s required competency.",
	"verdict.review.code.resource_assumption": "The explanation may assume instructional resources or facilities not established for this lesson.",
	"verdict.review.code.unknown": "The answer contains a static review warning that needs faculty review.",
	"programs.blockedBySpecializations": "{code} cannot be deleted while {list} inherit its Program Outcomes. Delete or relink that specialization first.",
	"programs.inheritsNote": "{code} inherits its Program Outcomes and EGAs from {source}. Deleting {code} does not affect {source}.",
	"verdict.outcomeSource": "Program Outcomes were checked against the authoritative outcomes of {source}.",
	"verdict.reference": "Reference",
	"verdict.verification.deterministic": "Fixed rule",
	"verdict.verification.quotes_verified": "Quotes verified",
	"verdict.verification.unverified": "Not verified",
	"verdict.verification.not_checked": "Not checked",
	"verdict.responsible.course_content": "Fix: course content",
	"verdict.responsible.ilo": "Fix: ILO",
	"verdict.responsible.clo": "Fix: CLO",
	"verdict.responsible.po_mapping": "Fix: PO/EGA tag",
	"verdict.responsible.clo_mapping": "Fix: CLO tag",
	"verdict.responsible.course_plan": "Fix: learning plan",
	"verdict.verification.cited_week_not_in_plan": "Cites a week not in the plan",
	"verdict.verification.derived_from_checked_relationships": "Derived from checked relationships",
	"verdict.scope.course": "Whole course",
	"verdict.clo": "CLO {n}",
	"hybrid.unresolved.duplicates_week": "The replacement topic it could offer mostly repeats a week the plan already teaches, so nothing is offered.",
	"verdict.coverage.adequate": "Coverage: adequate",
	"verdict.coverage.partial": "Coverage: partial",
	"verdict.coverage.insufficient": "Coverage: insufficient",
	"verdict.coverage.insufficient_evidence": "Coverage: cannot be decided",
	"verdict.responsible.institution_policy": "Institutional decision",
	"verdict.supportingWeeks": "Supporting weeks: {weeks}",
	"verdict.gap": "Gap",
	"verdict.verification.not_checked_yet": "Not checked",
	"verdict.responsible.activity": "Fix: learning activity",
	"verdict.responsible.assessment": "Fix: assessment task",
	"verdict.verification.derived_from_explanation": "Taken from the AI explanation",
	"verdict.verification.structured_field": "Taken from a structured answer field",
	"verdict.verification.contradictory_response": "The AI answer contradicts itself",
	"verdict.responseNote.aspects_missing": "Some answer fields were missing",
	"verdict.responseNote.aspects_malformed": "Some answer fields were invalid",
	"verdict.responseNote.contradictory": "Contradictory answer: review only",
	"verdict.responseNote.aspects_not_assessed": "Some answer fields were not assessed",
	"verdict.verification.aspects_not_assessed": "Rests on fields the AI did not assess",
	"verdict.verification.aspect_not_assessed": "Field not assessed by the AI",
	"verdict.aspect.teaching": "the teaching method",
	"verdict.aspect.learnerSupport": "the learner support",
	"verdict.aspect.measures": "whether the task measures the ILO",
	"verdict.aspect.evidence": "the evidence the task produces",
	"verdict.aspect.level": "the cognitive level of the task",
	"verdict.aspect.valueUse": "how the value is used",
	"verdict.aspect.carriedBy": "where the value is lived",
	"verdict.aspect.valueFit": "whether the value fits the lesson",
	"verdict.aspect.coreValue": "the core value supported",
	"verdict.aspect.integration": "whether the value is demonstrated",
	"verdict.aspect.relevance": "the relevance of the reference",
	"verdict.aspect.basis": "the basis of the relevance judgement",
	"verdict.responsible.values": "Fix: values statement",
	"verdict.responsible.references": "Fix: reference list",
	"verdict.verification.external_check": "Checked against an outside source",
	"verdict.authenticity.not_verified": "Authenticity not verified",
	"verdict.authenticity.verified": "DOI found; title and year agree",
	"verdict.authenticity.mismatch": "DOI found; title or year differ",
	"verdict.authenticity.not_found": "DOI not found",
	"verdict.authenticity.unavailable": "Outside check unavailable",
	"verdict.definitions.not_supplied": "No institutional value definitions supplied",
	"verdict.definitions.invalid": "Value definitions file is invalid and was ignored",
	"verdict.carriedBy.activity": "Value lived in: activity",
	"verdict.carriedBy.assessment": "Value lived in: assessment",
	"verdict.carriedBy.content": "Value lived in: content",
	"verdict.carriedBy.ilo": "Value lived in: ILO",
	"verdict.carriedBy.several": "Value lived in: several parts",
	"verdict.carriedBy.none": "Nothing in the lesson carries the value",
	"verdict.omitted": "{count} more finding(s) are not listed (failures and reviews are listed first).",
	"verdict.definitions.pending_approval": "Value definitions: published wording, awaiting institutional approval",
	"verdict.states.title": "Separate results",
	"verdict.states.identity": "Course identity",
	"verdict.states.structure": "Structure",
	"verdict.states.alignment": "Academic alignment",
	"verdict.states.values": "Institutional values",
	"verdict.states.references.format": "References: format",
	"verdict.states.references.relevance": "References: relevance",
	"verdict.states.references.authenticity": "References: authenticity",
	"verdict.identity.verified": "Verified in the approved curriculum",
	"verdict.identity.code_not_found": "Course code not in the approved curriculum",
	"verdict.identity.code_missing": "No course code entered",
	"verdict.identity.curriculum_unavailable": "No approved curriculum available",
	"verdict.identity.curriculum_ambiguous": "Several approved curricula; none selected",
	"verdict.identity.elsewhere": "This code exists in: {where}. It is not matched to this program.",
	"verdict.titleFormat": "Title written as \"{entered}\"; the approved spelling is \"{approved}\". This is a formatting suggestion only.",
	"verdict.verification.provisional_identity": "Provisional: course not verified in the curriculum",
	"verdict.coreValue": "Core value: {value}",
	"verdict.supportingValue": "Supporting value: {values}",
	"hybrid.unresolved.value_needs_review": "No Marian-Augustinian core value is named here, and nothing in the check supports recommending a particular one, so none is filled in. Needs review: choose the core value that students actually live in this lesson.",
	"hybrid.unresolved.value_supported": "No core value is named here, but what students do in this lesson supports {value}. Needs your decision: name it if you agree; the supporting value you wrote stays.",
	"hybrid.unresolved.retag_needs_review": "The check says this text can stay as written and only its tag does not fit, but no approved outcome was verified as the right tag, so none is proposed and nothing is changed. Needs your decision: review the tag, or the text if the tag is right.",
	"hybrid.unresolved.draft_needs_review": "A static review found possible unsupported or copied wording in the proposed rewrite, so it is withheld. Review the flagged wording and decide how to revise; the original faculty text is unchanged.",
	"verdict.msg.titleSubtitle": "The approved title continues with a parenthetical that the entered title leaves out; this is not matched automatically.",
	"verdict.msg.valueCompetency": "No official core value is named. The entries are academic competencies or graduate attributes, which are not Marian-Augustinian core values.",
	"verdict.msg.valueSupported": "No official core value is named. What students do in this lesson supports {value}; consider naming it alongside the supporting value.",
	"verdict.msg.valueSupporting": "No official core value is named. The entries are supporting values or behaviours; whether they express a core value depends on what students do in the lesson (see VAL-05).",
	"verdict.msg.classNeedsReview": "The lesson writes supporting values or behaviours and no official core value. Which core value they support depends on what students do in the lesson, and no verified evidence is available yet.",
	"verdict.msg.classCompetency": "The entries are academic competencies or graduate attributes (for example Critical Thinking). They are not Marian-Augustinian core values; name the core value the lesson lives through its activity.",
	"verdict.msg.classUnclassified": "The entries are not recognised as a core value, a supporting value or a competency. Nothing is concluded; please review.",
	"verdict.msg.keepWording": "Keep the wording if intended, and review it against what students do in this lesson. No replacement is proposed.",
	"verdict.msg.draftOffered": "A draft written from this lesson is offered among the recommendations; accept it only if it says what students actually do.",
	"verdict.msg.valueAdvice": "Needs review: name the Marian-Augustinian core value that students actually live in this lesson. The checker does not choose one for you.",
	"verdict.msg.considerNaming": "Consider naming {value}. Nothing is changed for you.",
	"verdict.msg.identityNotCounted": "Not counted: the course identity is not verified in the approved curriculum, so no claim is made that this fits the course.",
	"verdict.msg.titleCaseRequired": "Differs from the approved title only in capitalisation or spacing. Under the title policy in force the approved spelling is still required to submit.",
	"verdict.withheldTitle": "No rewrite offered",
	"verdict.withheld.upstream_invalid": "The lesson's course content or ILO is itself off, so correct that first; no rewrite of this field is offered.",
	"verdict.withheld.upstream_unverified": "The lesson's course content and ILO have not been verified (the Stage B checks are off or incomplete), so no rewrite of this field is offered.",
	"verdict.withheld.activity_invalid": "The learning activity is not aligned, so correct the activity first; no rewrite of this field is offered.",
	"verdict.withheld.assessment_invalid": "The assessment task is not aligned, so correct the assessment first; no rewrite of the values statement is offered.",
	"verdict.withheld.values_classified": "The values question for this lesson has been answered (see VAL-05), so its answer stands and no rewrite of the values statement is offered.",
	"verdict.withheld.content_sound": "The week's course content was verified to belong to the course, so it is not rewritten to fit this ILO; the ILO is the field to review.",
	"verdict.withheld.draft_review": "A static review found possible unsupported or copied wording in the proposed rewrite, so it is withheld for faculty review. The academic judgment and your original text are unchanged.",
	"verdict.withheld.retag_conflict": "The answers about this CLO's tags say the CLO can stay as written, so this rewrite is not offered; whether to change the CLO or its tags is your decision.",
	"verdict.withheld.clo_off_course": "This CLO was judged not to be about the course (CLO-03), so it is rewritten for the course first; no rewrite toward a PO or EGA is offered until then.",
	"verdict.msg.useApprovedValue": "Use the approved value: {value}",
	"verdict.msg.valueRequired": "Week {week}: integrate at least one Marian-Augustinian core value.",
	"verdict.msg.selectCourse": "Select this course from the approved curriculum of the program. The checker does not guess which course was meant.",
	"verdict.srv.apaDateMissing": "No publication date in the form (2020). was found after the authors.",
	"verdict.srv.apaDatePeriod": "The date should be followed by a period: ({date}).",
	"verdict.srv.apaDateRange": "The year {year} is not a plausible publication year.",
	"verdict.srv.apaAuthorMissing": "Nothing precedes the date. If the work has no author APA 7 begins with the title; this checker does not verify that form.",
	"verdict.srv.apaAuthorPeriod": "The author block should end with a period before the date.",
	"verdict.srv.apaAuthorForm": "The authors are not in the form \"Surname, A. B.\" and do not look like an organization.",
	"verdict.srv.apaAuthorAnd": "APA 7 joins the last author with \"&\", not \"and\".",
	"verdict.srv.apaAuthorComma": "APA 7 puts a comma before \"&\": \"Surname, A., & Surname, B.\"",
	"verdict.srv.apaAuthorAmpersand": "More than one author but no \"&\" before the last one.",
	"verdict.srv.apaAuthorInitials": "Initials should be written with periods (\"Smith, J. K.\").",
	"verdict.srv.apaTitleMissing": "No title was found after the date.",
	"verdict.srv.apaJournalVolume": "A journal article needs the journal name and a volume number (issue in parentheses).",
	"verdict.srv.apaJournalPages": "A journal article needs a page range or an article number.",
	"verdict.srv.apaJournalName": "The journal name was not found.",
	"verdict.srv.apaBookPublisher": "A book needs its publisher.",
	"verdict.srv.apaBookLocation": "APA 7 does not give the place of publication.",
	"verdict.srv.apaChapterPages": "A chapter in an edited book needs its page range, written (pp. 10-25).",
	"verdict.srv.apaChapterPublisher": "A chapter in an edited book is followed by the publisher of the book; none was recognised.",
	"verdict.srv.apaReportPublisher": "A report names its publisher unless the publisher is also the author; none was found.",
	"verdict.srv.apaConfIn": "A conference paper names the proceedings after \"In\".",
	"verdict.srv.apaWebUrl": "An online source needs its URL.",
	"verdict.srv.apaRetrieved": "\"Retrieved from\" is used in APA 7 only with a retrieval date, for pages that are meant to change.",
	"verdict.srv.apaTitleQuotes": "APA 7 does not put the title of an article, chapter or page in quotation marks.",
	"verdict.srv.apaAccessed": "\"Accessed\" is not APA 7 style; APA 7 uses \"Retrieved Month Day, Year, from URL\" only for pages meant to change.",
	"verdict.srv.apaDoiForm": "A DOI is written as a link: https://doi.org/{doi}",
	"verdict.srv.apaDoiMalformed": "The DOI link does not contain a DOI of the form 10.xxxx/yyyy.",
	"verdict.srv.apaUrlHttp": "The link uses http, not https: {url}",
	"verdict.srv.apaUrlMalformed": "This link is not a valid web address: {url}",
	"verdict.srv.apaUrlTwice": "Two links are given; APA 7 gives one.",
	"verdict.srv.apaKindUnclear": "The kind of source (book, article, conference paper, website, official document) could not be told from the text, so no rule specific to a kind of source was applied.",
	"verdict.srv.refMechanical": "Mechanical correction (uses only what the reference already contains): {text}",
	"verdict.srv.refAddMissing": "Add the missing part(s) ({parts}) exactly as they appear on the source itself.",
	"verdict.srv.refCorrectApa": "Correct this to follow APA 7 for this kind of source, using only what the source itself shows.",
	"verdict.srv.refNotVerified": "{count} of {total} reference(s) were not checked against any external source, so whether the works exist as cited is not known. A correct format does not show that a reference is authentic.",
	"verdict.srv.refDoiNotFound": "The DOI was not found in Crossref. Check it against the source; nothing is concluded about the work.",
	"verdict.srv.refDoiMismatch": "The DOI exists but is registered with another title or year{detail}. Check the reference against the source.",
	"verdict.srv.valCopied": "The same values statement is written in {count} of {total} lessons (\"{text}\"). A value that is copied unchanged cannot say how it is lived in each lesson. No value is required in every lesson, and the course need not use all six.",
	"verdict.srv.valCopiedFix": "Write the values statement of each lesson from what students do in that lesson; a value may repeat, its description should not.",
	"verdict.srv.valNotJudged": "Whether the values are integrated across the course could not be judged: no lesson has a verified answer yet. Values used so far: {values}.",
	"verdict.srv.valShare": "{count} of {total} lessons that name a value were judged to integrate it (values named: {values}). The share that raises a review ({percent}%) is a proposal, not an approved institutional threshold; no value is required in every lesson.",
	"verdict.srv.valShareFix": "Look at the lessons whose values statement was judged not to be integrated and describe, for each, what students do that expresses the value.",
	"verdict.srv.valFitsPartly": "The named value fits only part of what students do in this lesson. {detail}",
	"verdict.srv.taskVague": "The task does not say what is produced or answered. {detail}",
	"verdict.srv.taskBelow": "The task is below the level of the ILO. {detail}",
	"verdict.srv.taskAbove": "The task is above the level of the ILO. {detail}",
	"verdict.srv.contradicts": "The AI's answer contradicts itself ({reason}), so it is shown for review only. {detail}",
	"verdict.srv.restsOnUnassessedPass": "The verdict rests on what the AI did not assess in this answer ({fields}), so it is shown for review and not counted as a pass. {detail}",
	"verdict.srv.restsOnUnassessedFail": "The verdict rests on what the AI did not assess in this answer ({fields}), so it is shown for review and not counted as a failure. {detail}",
	"verdict.srv.aspectNotAssessed": "The AI did not assess {fields} in this answer, so this rule is not checked for this lesson.",
	"verdict.srv.noScopedCheck": "No scoped AI check covers this rule yet.",
	"verdict.srv.aiIncomplete": "Needs AI semantic evaluation, which did not complete.",
	"verdict.srv.approvalMeta": "Approval and revision metadata is not checked yet.",
	"verdict.srv.exportRendering": "Exported document rendering is not checked yet.",
	"verdict.srv.gradingPolicy": "No approved, versioned institutional grading policy is configured.",
	"verdict.srv.refAvailability": "Reference availability and version are not checked separately yet.",
	"verdict.srv.notApplicable": "Not applicable.",
	"verdict.srv.cloCountFix": "Ask the administrator to set exactly {count} CLOs for this course.",
	"verdict.srv.cloCount": "The syllabus has {count} CLOs; the institutional standard is exactly {total}.",
	"verdict.srv.iloMapping": "Map every lesson ILO to at least one existing CLO without duplicate mappings.",
	"verdict.srv.replaceFiller": "Replace it with the real course content.",
	"verdict.srv.filler": "The field holds placeholder or filler text, so it counts as filled but says nothing.",
	"verdict.srv.orientationHint": "Week 1 mentions orientation-type content (keyword hint only); a reviewer should confirm it covers objectives, requirements, grading and policies.",
	"verdict.srv.codeMismatch": "CRITICAL MISMATCH: Course Code {code} does not exist in the official {program} curriculum."
};
const hybridTl = {
	"hybrid.refine": "Suriin at pagbutihin",
	"hybrid.refining": "Sinusuri…",
	"hybrid.applyVerified": "Ilapat ang nasuring bersiyon",
	"hybrid.refineOk": "Nasuri laban sa {checked} kaugnay na bagay: {improved} ang bumubuti at wala ang lumalala. Ligtas itong tanggapin.",
	"hybrid.refineRewritten": "Mapapalala ng unang burador ang ibang bagay, kaya sumulat ng bagong bersiyon at sinuri laban sa {checked} kaugnay na bagay: {improved} ang bumubuti at wala ang lumalala. Nasa kahon sa itaas ito.",
	"hybrid.refineBlocked": "Walang bersiyong nakatugon sa lahat ng kaugnay na bagay: {worse} sa {checked} ang lalala. Maaari mong i-edit ang teksto mismo, o tanggapin ito kahit may kapalit.",
	"hybrid.refineBlockers": "Ang humahadlang",
	"hybrid.refineFailed": "Hindi masuri ang mungkahi.",
	"hybrid.label.ALIGNED": "Tugma",
	"hybrid.refreshSuggestions": "Mula sa mas lumang bersiyon ng checker ang mga mungkahing ito. Pindutin ang Re-Check again upang makabuo ng mga mungkahing ligtas na mailalapat sa burador na ito.",
	"hybrid.suggestionTargetChanged": "Nagbago ang field o hanay mula nang mabuo ang mungkahi. Panatilihin ang iyong pagbabago o pindutin ang Re-Check again para sa bagong mungkahi.",
	"hybrid.suggestionSaveFailed": "Hindi na-save ang mungkahing pagbabago. Bukas pa ang burador; subukang muli matapos ayusin ang error sa pag-save.",
	"hybrid.savedDecisionFailed": "Na-save ang burador ngunit hindi naitala ang pasya sa mungkahi: {message}",
	"hybrid.appliedSaved": "Nailapat at na-save",
	"hybrid.decision.accept": "Tinanggap",
	"hybrid.decision.edit": "Naedit",
	"hybrid.decision.reject": "Tinanggihan",
	"hybrid.aiCheck": "AI CHECK",
	"hybrid.handled": "Mga nailapat na mungkahi ({count})",
	"hybrid.allHandled": "Nailapat na ang lahat ng mungkahi. Pindutin ang Re-Check again para ma-refresh ang marka.",
	"hybrid.noDraftTitle": "Mga problemang walang mungkahing tatanggapin ({count})",
	"hybrid.unlinkedNote": "{count} nito ang walang mungkahing burador. Buksan ang detalye para makita ang aayusin nang mano-mano. Ang iba ay ipinaliwanag sa mungkahi sa ibaba.",
	"hybrid.allLinked": "Ang bawat isa rito ay ipinaliwanag sa mungkahing nag-aayos nito sa ibaba.",
	"hybrid.fixes": "Bakit ito iminumungkahi: inaayos ang {count}",
	"hybrid.reused": "Ginamit muli ang {reused} naunang hatol · {asked} ang itinanong sa AI",
	"hybrid.reusedHint": "Ang mga ugnayang hindi nagbago ang teksto mula sa huling pagsusuri ay nananatili ang naunang beripikadong hatol, kaya ang nagbago lamang ang ipinadala sa AI.",
	"hybrid.readOnlyNote": "Ang may-akda lamang ang makakatanggap o makapagbabago ng mga ito. Makikita nila ito sa sarili nilang hakbang ng Review at Check, at makikita ng admin at ng may-akda kung alin ang nailapat.",
	"hybrid.suggestedText": "Mungkahing teksto",
	"hybrid.appliedByAuthor": "Inilapat ng may-akda",
	"hybrid.rejectedByAuthor": "Tinanggihan ng may-akda",
	"activity.check": "nagpatakbo ng AI check sa",
	"activity.recommend": "sumagot sa isang mungkahi sa",
	"activity.accepted": "tinanggap ang isang mungkahi sa",
	"activity.edited": "inedit at inilapat ang isang mungkahi sa",
	"activity.rejected": "tinanggihan ang isang mungkahi sa",
	"hybrid.advisory": "Sanggunian · payo lamang",
	"hybrid.viewDetails": "Tingnan ang detalye",
	"hybrid.closeProblems": "Isara",
	"hybrid.count.high": "{count} mabigat",
	"hybrid.count.medium": "{count} pagbubutihin",
	"hybrid.undo": "Ibalik ang pagbabago",
	"hybrid.cannotUndo": "Hindi awtomatikong maibabalik ang pagbabagong ito dahil hindi naitala ang orihinal na teksto. I-edit ang field nang mano-mano.",
	"hybrid.checkButton": "AI Checker",
	"hybrid.recheckButton": "Re-Check again",
	"hybrid.checkDetails": "Tingnan ang mga detalye ng pagsusuri",
	"hybrid.codedEvidence": "Katibayan ng mga tuntunin ({count} pagsusuri)",
	"hybrid.policy": "Patakaran sa pagmamarka: {version}",
	"hybrid.check.PASS": "Pumasa",
	"hybrid.check.FAIL": "Hindi pumasa",
	"hybrid.check.NOT_EVALUATED": "Hindi pa nasusuri",
	"hybrid.check.NOT_APPLICABLE": "Hindi naaangkop",
	"hybrid.actual": "Isinumite o naobserbahang halaga",
	"hybrid.expected": "Kinakailangang halaga",
	"hybrid.label": "Pinagsamang pagsusuri ng silabus",
	"hybrid.alignment": "Pagkakatugma ayon sa AI: {status}",
	"hybrid.model": "Modelo: {model}",
	"hybrid.status.completed": "nakumpleto",
	"hybrid.status.not_evaluated": "hindi pa nasusuri",
	"hybrid.notScored": "wala pang marka",
	"hybrid.scores": "Marka mula sa mga tuntunin: {base}%. Bawas: {deductions} puntos. Huling beripikadong marka: {score}.",
	"hybrid.unavailableScore": "Hindi pa magagamit",
	"hybrid.incomplete": "Hindi pa kumpleto ang beripikasyon",
	"hybrid.incompleteNote": "Hindi pa kumpleto ang beripikasyon. Wala pang huling marka mula sa AI.",
	"hybrid.codedAreas": "Sinusukat ng mga tuntunin sa ibaba ang pagkakakumpleto at saklaw ng form, hindi ang pagkakatugma ng kahulugan ayon sa AI.",
	"hybrid.locked": "Hindi pa maaaring isumite hangga’t hindi nakukumpleto ang pagsusuri sa opisyal na kurikulum, teksto ng institusyon, estruktura, mga sanggunian at pagkakatugma gamit ang aktibong AI.",
	"hybrid.evidence": "Katibayan ng pagkakatugma mula sa AI ({count} ugnayan)",
	"hybrid.bloom": "Antas ayon kay Bloom: {source} → {target}",
	"hybrid.source": "Pinagmulan: “{quote}”",
	"hybrid.target": "Katapat: “{quote}”",
	"hybrid.deductions": "Mga bawas sa marka",
	"hybrid.points": "{reason}: −{points} puntos ({id})",
	"hybrid.recommendation": "Rekomendasyon ng AI ({count})",
	"hybrid.recommendations": "Mga Rekomendasyon ng AI ({count})",
	"hybrid.applyNote": "Ilalapat at ise-save ng Tanggapin ang ipinakitang mungkahi. Ise-save ng I-edit at ilapat ang iyong rebisyon. Maaari pang tanggapin ang ibang mungkahi kung hindi nagbago ang kanilang mga field. Pindutin ang Re-Check again kapag handa nang kumuha ng bagong marka.",
	"hybrid.attachNote": "Itinatala ng Tanggapin o I-edit ang mungkahing burador para sa may-akda. Hindi nito binabago ang kanilang silabus.",
	"hybrid.editText": "I-edit ang mungkahing teksto",
	"hybrid.editLabel": "I-edit ang mungkahi {id}",
	"hybrid.accept": "Tanggapin",
	"hybrid.editApply": "I-edit at ilapat",
	"hybrid.editSave": "I-save ang naedit na burador",
	"hybrid.reject": "Tanggihan",
	"hybrid.unavailable": "Hindi magagamit ang pinagsamang pagsusuri. Mananatiling nakasara ang pagsusumite hanggang maihanda ang checker.",
	"hybrid.required": "Kumpletuhin muna ang aktibong pagsusuri ng AI at lahat ng kailangang tuntunin sa naka-save na form.",
	"hybrid.submitVersion": "Isumite ang bagong bersiyon sa Admin",
	"hybrid.submit": "Isumite sa Admin",
	"hybrid.curriculumYear": "Taon ng kurikulum",
	"hybrid.yearExample": "Halimbawa, 2022-2023",
	"hybrid.yearLevel": "Antas ng taon",
	"hybrid.changed": "Nagbago ang form. Suriin muli bago ilapat ang mungkahi.",
	"hybrid.recheckBanner": "Nagbago ang silabus matapos ang pagsusuring ito. Pindutin ang Re-Check again para suriin muli ang pagkakatugma bago isumite.",
	"hybrid.applying": "Inilalapat…",
	"hybrid.applyFailed": "Hindi mailapat ang pagbabago. Walang binago sa silabus.",
	"hybrid.cardStale": "Hindi mailalapat ang mungkahing ito: mula ito sa mas lumang pagsusuri. Pindutin ang Re-Check again para sa bago.",
	"hybrid.cardApplied": "Na-update at na-save sa silabus ang {what}. Suriin muli para ma-refresh ang marka.",
	"hybrid.problemsShort": "{count} aayusin",
	"hybrid.recsShort": "{count} mungkahi",
	"hybrid.scoreBase": "Marka mula sa mga tuntunin",
	"hybrid.scoreDeducted": "Mga bawas",
	"hybrid.scoreFinal": "Beripikadong marka",
	"hybrid.lockedTitle": "Nakasara ang pagsusumite",
	"hybrid.problems": "Mga dapat bigyang-pansin ({count})",
	"hybrid.sev.high": "Pinakamabigat",
	"hybrid.sev.medium": "Mainam pagbutihin",
	"hybrid.hardGateRequired": "Ayusin muna ang mga kinakailangang tuntunin sa hakbang ng Review bago isumite.",
	"hybrid.hardGateTitle": "Kailangang pumasa ang mga tuntuning ito bago ka makapagsumite",
	"hybrid.hardGateText": "Galing ang mga ito sa opisyal na kurikulum at sa karaniwang form, hindi sa AI.",
	"hybrid.qualityTitle": "Mga tala sa kalidad ({count})",
	"hybrid.qualityNote": "Payo lamang. Nagmumula ang mga tala sa mismong teksto ng silabus. Hindi nito binabago ang marka o hinaharang ang pagsusumite, at ikaw ang magpapasya kung may angkop.",
	"hybrid.qualityAction": "Maaari mong:",
	"hybrid.quality.outcome_quality": "Mga inaasahang bunga",
	"hybrid.quality.learning_progression": "Daloy ng pagkatuto",
	"hybrid.quality.assessment_quality": "Pagtataya",
	"hybrid.quality.coverage": "Saklaw",
	"hybrid.quality.workload": "Dami ng gawain",
	"hybrid.quality.accessibility": "Pag-access",
	"hybrid.summary.no_changes_needed": "Wala nang kailangang baguhin. Pumasa ang mga kinakailangang pagsusuri at walang natirang mahalagang problema.",
	"hybrid.summary.optionalAvailable": "{count} opsyonal na mungkahi ang magagamit kung nais mo.",
	"hybrid.summary.material_open": "{count} tiyak na problema ang kailangan pang tugunan.",
	"hybrid.summary.mandatory_open": "May kinakailangang patakarang hindi pa pumapasa. Dapat itong ayusin bago maisumite.",
	"hybrid.summary.incomplete": "Hindi natapos ang pagsusuri ng AI, kaya hindi pa masasabi kung may kailangang baguhin.",
	"hybrid.regressedNote": "Naayos ng nauna mong pagbabago sa {path} ang orihinal na problema nito, ngunit may ibang ugnayang pumalya.",
	"hybrid.tier.mandatory": "Kinakailangan",
	"hybrid.tier.material": "Kailangang tugunan",
	"hybrid.tier.optional": "Opsyonal",
	"hybrid.attempt": "Pagtatangka {n} sa {max}",
	"hybrid.unresolvedTitle": "Kailangan ng iyong pasya ({count})",
	"hybrid.unresolvedNote": "Walang nahanap na pagsulat muli ang checker na nag-aayos nito, kaya huminto ito sa halip na mag-alok ng mas marami pang bersyon. Kasama pa rin ang mga ito sa marka.",
	"hybrid.unresolved.no_change_proposed": "Walang binago ang tanging pagsulat muli na naialok nito, kaya walang maaaring ilapat.",
	"hybrid.unresolved.attempt_limit": "Nakapag-alok na ito ng {attempts} pagsulat muli para dito at nananatili ang problema.",
	"hybrid.refineNoChange": "Walang mahalagang binabago ng iminungkahing teksto sa field, kaya walang maaaring ilapat.",
	"hybrid.provisional": "Pansamantala",
	"hybrid.provisionalAria": "Pansamantalang marka na {score} porsiyento. Hindi pa tapos ang pagsusuri.",
	"hybrid.provisionalCoverage": "Pansamantalang marka: {verified} sa {total} ugnayan ang nasuri. Patakbuhin muli ang pagsusuri para matapos ito at makuha ang pinal na marka. Ang mga mungkahi sa ibaba ay para sa mga nasuri na.",
	"hybrid.provisionalPlain": "Pansamantalang marka. Patakbuhin muli ang pagsusuri para makuha ang pinal na marka. Ang mga mungkahi sa ibaba ay para sa mga nasuri na.",
	"hybrid.provisionalRule": "Pansamantalang marka. Kailangan ding pumasa ang isang kinakailangang patakaran bago ito maging pinal. Ang mga mungkahi sa ibaba ay para sa mga nasuri na.",
	"hybrid.adviceTitle": "Payo lamang ang pagsusuri ng AI",
	"hybrid.adviceText": "Ikaw ang magpapasya kung ano ang pagbubutihin. Maaari kang magsumite kahit hindi mo inilapat ang mga mungkahi, at makikita ng tagasuri ang resultang ito.",
	"hybrid.advisoryIncomplete": "Hindi pa kumpleto ang pagsusuri ng AI, kaya wala pang huling marka mula rito. Maaari ka pa ring magsumite.",
	"hybrid.label.INSUFFICIENT_EVIDENCE": "Hindi maberipika",
	"hybrid.label.NOT_ALIGNED": "Hindi tugma",
	"hybrid.label.PARTIALLY_ALIGNED": "Bahagyang tugma",
	"hybrid.pts": "−{points} puntos",
	"hybrid.where": "Sa {where}",
	"hybrid.quoteSource": "Mula sa silabus",
	"hybrid.quoteTarget": "Ikinumpara sa",
	"hybrid.noProblems": "Walang nakitang problema. Tugma ang bawat sinuring ugnayan.",
	"hybrid.kind.clo": "Layunin ng kurso",
	"hybrid.kind.ilo": "Layunin ng aralin",
	"hybrid.kind.plan": "Plano ng pagkatuto",
	"hybrid.kind.outcomes": "Mga layunin ng institusyon",
	"hybrid.kind.meta": "Detalye ng kurso",
	"hybrid.kind.other": "Burador",
	"verdict.title": "Akademikong hatol (payo lamang)",
	"verdict.note": "Payo lamang ito. Hindi nito binabago ang opisyal na marka at hindi nito hinaharang ang pagsusumite. Ang kumpletong silabus ay hindi laging nakahanay.",
	"verdict.completeness": "Pagkakumpleto",
	"verdict.completenessNone": "Walang marka",
	"verdict.curriculum": "Kurikulum",
	"verdict.alignment": "Akademikong pagkakahanay",
	"verdict.overall": "Pangkalahatan",
	"verdict.status.PASS": "Pasado",
	"verdict.status.FAIL": "Bagsak",
	"verdict.status.NEEDS_REVIEW": "Kailangang suriin",
	"verdict.status.NOT_CHECKED": "Hindi nasuri",
	"verdict.status.NOT_APPLICABLE": "Hindi naaangkop",
	"verdict.overall.COMPLIANT": "Sumusunod sa nasuri",
	"verdict.overall.NOT_COMPLIANT": "Hindi sumusunod",
	"verdict.overall.NEEDS_REVIEW": "Kailangang suriin",
	"verdict.overall.PARTIAL_VALIDATION": "Bahagyang nasuri",
	"verdict.method.deterministic": "Takdang patakaran",
	"verdict.method.course_profile": "Sanggunian ng kurso",
	"verdict.method.ai_semantic": "Pagsusuri ng AI",
	"verdict.partial": "{count} pagsusuri ang hindi nagawa at hindi binibilang bilang pasado.",
	"verdict.issues": "Mga natuklasan",
	"verdict.unverified": "Hindi nasuri",
	"verdict.week": "Linggo {week}",
	"verdict.original": "Kasalukuyang teksto",
	"verdict.suggestion": "Iminumungkahing muling pagsulat (hindi pa napatunayan; kailangan ang iyong pag-apruba)",
	"verdict.review.explanationTitle": "Kailangang suriin ng guro ang paliwanag",
	"verdict.review.explanationNote": "Hindi binabago ng mga babalang ito mula sa heuristic ang akademikong pasya. Ang napatunayang sipi ay hindi patunay na tama ang pangangatwiran tungkol dito.",
	"verdict.review.draftTitle": "Kailangang suriin ng guro ang draft",
	"verdict.review.draftNote": "Hindi iniaalok ang draft. Tinutukoy ng mga babalang ito mula sa heuristic ang mga salitang maaaring walang sapat na batayan; pinananatili ang orihinal na teksto ng guro.",
	"verdict.review.draftWarningTitle": "Paalala lamang tungkol sa draft",
	"verdict.review.draftWarningNote": "Ang paalalang ito lamang ay hindi dahilan upang ipagkait ang draft o baguhin ang akademikong pasya. Hindi patunay ng hindi angkop na pagwawasto ang magkatulad na mga salita; tiyakin muna ang panukala bago gamitin.",
	"verdict.review.phrase": "Mga salitang dapat suriin: “{phrase}”.",
	"verdict.review.code.explanation_from_other_pair": "Maaaring gumamit ang paliwanag ng mga salita mula sa ibang ugnayang nakita ng AI.",
	"verdict.review.code.cites_other_week": "Bumabanggit ang paliwanag ng linggong hindi saklaw ng araling ito.",
	"verdict.review.code.venue_claim": "Hindi nakasaad sa tala ng sanggunian ang pahayag tungkol sa tagapaglathala, journal o pinagmulan.",
	"verdict.review.code.metadata_claim": "Walang sapat na batayan sa ibinigay na teksto ang pahayag tungkol sa metadata o katayuan ng sanggunian.",
	"verdict.review.code.basis_overstated": "Maaaring hindi sinusuportahan ng pinangalanang tagapaglathala o journal ang sinasabing batayan ng ebidensiya.",
	"verdict.review.code.basis_contradicts_relevance": "Kailangang sabay na suriin ang batayan ng ebidensiya at ang tiyak na pasya sa kaugnayan.",
	"verdict.review.code.copies_other_relationship": "Maaaring kumopya ang draft ng mga salita mula sa ibang ugnayang nakita ng AI.",
	"verdict.review.code.adds_participant": "Nagdaragdag ang draft ng mga kalahok na hindi nakasaad sa araling ito.",
	"verdict.review.code.adds_activity": "Nagdaragdag ang draft ng gawaing hindi nakasaad sa araling ito.",
	"verdict.review.code.adds_resource": "Nagdaragdag ang draft ng mga kagamitang hindi nakasaad sa araling ito.",
	"verdict.review.code.adds_week": "Nagdaragdag ang draft ng oras o linggong hindi nakasaad sa araling ito.",
	"verdict.review.code.value_not_expressed": "Maaaring idinikit lamang ng draft ang pangalan ng pagpapahalaga sa teknikal na hakbang nang hindi ipinakikita kung paano ito isinasabuhay.",
	"verdict.review.code.copies_reference": "Kinokopya ng draft ang karamihan ng mga salita sa sanggunian.",
	"verdict.review.code.keeps_off_subject": "Pinananatili ng draft ang marami sa mga salitang itinuring na labas sa paksa ng kurso.",
	"verdict.review.code.unnecessary_practical": "Maaaring magdagdag ang draft ng praktikal na gawaing hindi hinihingi ng konseptuwal na ILO.",
	"verdict.review.code.expands_competency": "Maaaring palawakin ng draft ang kinakailangang kakayahan nang higit sa ILO ng araling ito.",
	"verdict.review.code.assumes_resource": "Maaaring ipagpalagay ng draft na may kagamitang panglaboratoryo, software, pasilidad o iba pang sangguniang hindi pa natitiyak na magagamit.",
	"verdict.review.code.borrowed_wording": "May mga salitang katulad ng nasa ibang ugnayan ang draft, ngunit hindi nito pinatutunayang hindi angkop ang panukala.",
	"verdict.review.code.conditional_resource": "May kondisyon ang paggamit ng kagamitan sa draft. Kailangang tiyakin pa rin ng guro ang pagkakaroon nito at kung maisasagawa ang gawain.",
	"verdict.review.code.proposed_resource": "Iminumungkahi ng draft ang paghahanda o pagbibigay ng mga materyales sa pagtuturo. Kailangang tiyakin ng guro na magagawa at maibibigay ang mga ito; hindi pa naitatag na mayroon na nito.",
	"verdict.review.code.resource_needs_confirmation": "Hindi malinaw ang pagbanggit sa mga materyales sa pagtuturo. Kailangang tiyakin ng guro kung mayroon na nito o iminumungkahi pa lamang ang paggawa; hindi sapat ang babalang ito upang hindi ialok ang draft.",
	"verdict.review.code.practical_requirement": "Maaaring hinango ng paliwanag ang pangangailangan sa praktikal na gawain mula sa konteksto ng kurso sa halip na sa kakayahang hinihingi ng ILO.",
	"verdict.review.code.resource_assumption": "Maaaring ipagpalagay ng paliwanag na may kagamitang panturo o pasilidad na hindi pa natitiyak para sa araling ito.",
	"verdict.review.code.unknown": "May babala mula sa static na pagsusuri ang sagot na kailangang suriin ng guro.",
	"programs.blockedBySpecializations": "Hindi mabubura ang {code} habang minamana ng {list} ang mga Program Outcome nito. Burahin o ilipat muna ang espesyalisasyon.",
	"programs.inheritsNote": "Minamana ng {code} ang Program Outcomes at EGAs mula sa {source}. Hindi maaapektuhan ang {source} kapag binura ang {code}.",
	"verdict.outcomeSource": "Sinuri ang mga Program Outcome laban sa opisyal na outcomes ng {source}.",
	"verdict.reference": "Sanggunian",
	"verdict.verification.deterministic": "Takdang patakaran",
	"verdict.verification.quotes_verified": "Napatunayan ang mga sipi",
	"verdict.verification.unverified": "Hindi napatunayan",
	"verdict.verification.not_checked": "Hindi nasuri",
	"verdict.responsible.course_content": "Ayusin: nilalaman ng kurso",
	"verdict.responsible.ilo": "Ayusin: ILO",
	"verdict.responsible.clo": "Ayusin: CLO",
	"verdict.responsible.po_mapping": "Ayusin: tag ng PO/EGA",
	"verdict.responsible.clo_mapping": "Ayusin: tag ng CLO",
	"verdict.responsible.course_plan": "Ayusin: plano ng pag-aaral",
	"verdict.verification.cited_week_not_in_plan": "Binabanggit ang linggong wala sa plano",
	"verdict.verification.derived_from_checked_relationships": "Hango sa mga nasuring ugnayan",
	"verdict.scope.course": "Buong kurso",
	"verdict.clo": "CLO {n}",
	"hybrid.unresolved.duplicates_week": "Halos inuulit ng alok na kapalit na paksa ang isang linggong itinuturo na ng plano, kaya walang inaalok.",
	"verdict.coverage.adequate": "Saklaw: sapat",
	"verdict.coverage.partial": "Saklaw: bahagya",
	"verdict.coverage.insufficient": "Saklaw: hindi sapat",
	"verdict.coverage.insufficient_evidence": "Saklaw: hindi matukoy",
	"verdict.responsible.institution_policy": "Desisyon ng institusyon",
	"verdict.supportingWeeks": "Mga sumusuportang linggo: {weeks}",
	"verdict.gap": "Kakulangan",
	"verdict.verification.not_checked_yet": "Hindi nasuri",
	"verdict.responsible.activity": "Ayusin: gawaing pampagkatuto",
	"verdict.responsible.assessment": "Ayusin: gawain sa pagtatasa",
	"verdict.verification.derived_from_explanation": "Hango sa paliwanag ng AI",
	"verdict.verification.structured_field": "Hango sa nakabalangkas na sagot",
	"verdict.verification.contradictory_response": "Sumasalungat sa sarili ang sagot ng AI",
	"verdict.responseNote.aspects_missing": "May kulang na bahagi ng sagot",
	"verdict.responseNote.aspects_malformed": "May di-wastong bahagi ng sagot",
	"verdict.responseNote.contradictory": "Magkasalungat na sagot: suriin lamang",
	"verdict.responseNote.aspects_not_assessed": "May bahagi ng sagot na hindi sinuri",
	"verdict.verification.aspects_not_assessed": "Nakasalalay sa mga bahaging hindi sinuri ng AI",
	"verdict.verification.aspect_not_assessed": "Bahaging hindi sinuri ng AI",
	"verdict.aspect.teaching": "paraan ng pagtuturo",
	"verdict.aspect.learnerSupport": "suporta sa mag-aaral",
	"verdict.aspect.measures": "kung sinusukat ng gawain ang ILO",
	"verdict.aspect.evidence": "ebidensyang nalilikha ng gawain",
	"verdict.aspect.level": "antas kognitibo ng gawain",
	"verdict.aspect.valueUse": "kung paano ginagamit ang pagpapahalaga",
	"verdict.aspect.carriedBy": "kung saan isinasabuhay ang pagpapahalaga",
	"verdict.aspect.valueFit": "kung tugma ang pagpapahalaga sa aralin",
	"verdict.aspect.coreValue": "pangunahing pagpapahalagang sinusuportahan",
	"verdict.aspect.integration": "kung naipapakita ang pagpapahalaga",
	"verdict.aspect.relevance": "kaugnayan ng sanggunian",
	"verdict.aspect.basis": "batayan ng paghatol sa kaugnayan",
	"verdict.responsible.values": "Ayusin: pahayag ng mga pagpapahalaga",
	"verdict.responsible.references": "Ayusin: listahan ng sanggunian",
	"verdict.verification.external_check": "Sinuri sa labas na batayan",
	"verdict.authenticity.not_verified": "Hindi napatunayan kung totoo ang sanggunian",
	"verdict.authenticity.verified": "Nahanap ang DOI; magkatugma ang pamagat at taon",
	"verdict.authenticity.mismatch": "Nahanap ang DOI; magkaiba ang pamagat o taon",
	"verdict.authenticity.not_found": "Hindi nahanap ang DOI",
	"verdict.authenticity.unavailable": "Hindi magamit ang labas na pagsusuri",
	"verdict.definitions.not_supplied": "Walang ibinigay na opisyal na kahulugan ng mga pagpapahalaga",
	"verdict.definitions.invalid": "Di-wasto ang file ng kahulugan ng mga pagpapahalaga kaya hindi ito ginamit",
	"verdict.carriedBy.activity": "Isinasabuhay sa: gawain",
	"verdict.carriedBy.assessment": "Isinasabuhay sa: pagtatasa",
	"verdict.carriedBy.content": "Isinasabuhay sa: nilalaman",
	"verdict.carriedBy.ilo": "Isinasabuhay sa: ILO",
	"verdict.carriedBy.several": "Isinasabuhay sa: ilang bahagi",
	"verdict.carriedBy.none": "Walang bahagi ng aralin na nagdadala ng pagpapahalaga",
	"verdict.omitted": "May {count} pang natuklasan na hindi nakalista (nauuna ang mga pagkabigo at dapat suriin).",
	"verdict.definitions.pending_approval": "Kahulugan ng pagpapahalaga: nailathalang salita, hinihintay ang pag-apruba ng institusyon",
	"verdict.states.title": "Magkakahiwalay na resulta",
	"verdict.states.identity": "Pagkakakilanlan ng kurso",
	"verdict.states.structure": "Estruktura",
	"verdict.states.alignment": "Akademikong pagkakahanay",
	"verdict.states.values": "Mga pagpapahalaga ng institusyon",
	"verdict.states.references.format": "Mga sanggunian: anyo",
	"verdict.states.references.relevance": "Mga sanggunian: kaugnayan",
	"verdict.states.references.authenticity": "Mga sanggunian: pagiging totoo",
	"verdict.identity.verified": "Napatunayan sa aprubadong kurikulum",
	"verdict.identity.code_not_found": "Wala sa aprubadong kurikulum ang code ng kurso",
	"verdict.identity.code_missing": "Walang inilagay na code ng kurso",
	"verdict.identity.curriculum_unavailable": "Walang magagamit na aprubadong kurikulum",
	"verdict.identity.curriculum_ambiguous": "Maraming aprubadong kurikulum; wala pang napili",
	"verdict.identity.elsewhere": "Umiiral ang code na ito sa: {where}. Hindi ito itinutugma sa programang ito.",
	"verdict.titleFormat": "Nakasulat ang pamagat bilang \"{entered}\"; ang aprubadong baybay ay \"{approved}\". Mungkahi lamang ito sa anyo.",
	"verdict.verification.provisional_identity": "Pansamantala: hindi napatunayan ang kurso sa kurikulum",
	"verdict.coreValue": "Pangunahing pagpapahalaga: {value}",
	"verdict.supportingValue": "Sumusuportang pagpapahalaga: {values}",
	"hybrid.unresolved.value_needs_review": "Walang nakasaad na pangunahing pagpapahalagang Marian-Augustinian dito, at walang batayan sa pagsusuri para magmungkahi ng partikular na isa, kaya walang inilagay. Dapat suriin: piliin ang pangunahing pagpapahalagang talagang isinasabuhay ng mga mag-aaral sa araling ito.",
	"hybrid.unresolved.value_supported": "Walang nakasaad na pangunahing pagpapahalaga dito, ngunit sinusuportahan ng ginagawa ng mga mag-aaral sa araling ito ang {value}. Kailangan ng iyong pasya: isulat ito kung sang-ayon ka; mananatili ang sumusuportang pagpapahalagang isinulat mo.",
	"hybrid.unresolved.retag_needs_review": "Ayon sa pagsusuri, maaaring manatili ang tekstong ito gaya ng pagkakasulat at ang tag lamang nito ang hindi angkop, ngunit walang napatunayang aprubadong kinalabasan na tamang tag, kaya walang iminumungkahi at walang binabago. Kailangan ng iyong pasya: suriin ang tag, o ang teksto kung tama ang tag.",
	"hybrid.unresolved.draft_needs_review": "May nakitang posibleng walang batayan o kinopyang mga salita ang static na pagsusuri sa iminungkahing muling pagsulat, kaya hindi ito iniaalok. Suriin ang mga salitang tinukoy at magpasya kung paano babaguhin ang teksto; hindi nagbabago ang orihinal na teksto ng guro.",
	"verdict.msg.titleSubtitle": "Ang aprubadong pamagat ay may karugtong na nasa panaklong na wala sa inilagay na pamagat; hindi ito awtomatikong itinutugma.",
	"verdict.msg.valueCompetency": "Walang nakasaad na opisyal na pangunahing pagpapahalaga. Ang mga nakasulat ay mga akademikong kakayahan o katangian ng nagtapos, na hindi mga pangunahing pagpapahalagang Marian-Augustinian.",
	"verdict.msg.valueSupported": "Walang nakasaad na opisyal na pangunahing pagpapahalaga. Sinusuportahan ng ginagawa ng mga mag-aaral sa araling ito ang {value}; isaalang-alang na isulat ito kasama ng sumusuportang pagpapahalaga.",
	"verdict.msg.valueSupporting": "Walang nakasaad na opisyal na pangunahing pagpapahalaga. Ang mga nakasulat ay mga sumusuportang pagpapahalaga o pag-uugali; kung nagpapahayag ang mga ito ng isang pangunahing pagpapahalaga ay nakasalalay sa ginagawa ng mga mag-aaral sa aralin (tingnan ang VAL-05).",
	"verdict.msg.classNeedsReview": "Ang aralin ay may nakasulat na mga sumusuportang pagpapahalaga o pag-uugali at walang opisyal na pangunahing pagpapahalaga. Kung aling pangunahing pagpapahalaga ang sinusuportahan ng mga ito ay nakasalalay sa ginagawa ng mga mag-aaral sa aralin, at wala pang napatunayang ebidensya.",
	"verdict.msg.classCompetency": "Ang mga nakasulat ay mga akademikong kakayahan o katangian ng nagtapos (halimbawa, Critical Thinking). Hindi ang mga ito mga pangunahing pagpapahalagang Marian-Augustinian; isulat ang pangunahing pagpapahalagang isinasabuhay ng aralin sa pamamagitan ng gawain nito.",
	"verdict.msg.classUnclassified": "Hindi kinikilala ang mga nakasulat bilang pangunahing pagpapahalaga, sumusuportang pagpapahalaga, o kakayahan. Walang ipinapasya; pakisuri.",
	"verdict.msg.keepWording": "Panatilihin ang pananalita kung sinadya, at suriin ito batay sa ginagawa ng mga mag-aaral sa araling ito. Walang iminumungkahing kapalit.",
	"verdict.msg.draftOffered": "May borador na isinulat mula sa araling ito sa mga rekomendasyon; tanggapin lamang ito kung inilalarawan nito ang talagang ginagawa ng mga mag-aaral.",
	"verdict.msg.valueAdvice": "Dapat suriin: isulat ang pangunahing pagpapahalagang Marian-Augustinian na talagang isinasabuhay ng mga mag-aaral sa araling ito. Hindi ito pinipili ng tagasuri para sa iyo.",
	"verdict.msg.considerNaming": "Isaalang-alang na isulat ang {value}. Walang binabago para sa iyo.",
	"verdict.msg.identityNotCounted": "Hindi binibilang: hindi napatunayan ang pagkakakilanlan ng kurso sa aprubadong kurikulum, kaya walang sinasabing angkop ito sa kurso.",
	"verdict.msg.titleCaseRequired": "Naiiba sa aprubadong pamagat sa malaki o maliit na titik o sa pagitan lamang. Sa umiiral na patakaran sa pamagat, kailangan pa rin ang aprubadong baybay upang maisumite.",
	"verdict.withheldTitle": "Walang iminumungkahing muling pagsulat",
	"verdict.withheld.upstream_invalid": "Mali mismo ang nilalaman ng kurso o ang ILO ng araling ito, kaya ayusin muna iyon; walang iminumungkahing muling pagsulat ng bahaging ito.",
	"verdict.withheld.upstream_unverified": "Hindi pa napapatunayan ang nilalaman ng kurso at ang ILO ng araling ito (naka-off o hindi kumpleto ang mga pagsusuri ng Stage B), kaya walang iminumungkahing muling pagsulat ng bahaging ito.",
	"verdict.withheld.activity_invalid": "Hindi nakahanay ang gawaing pampagkatuto, kaya ayusin muna ang gawain; walang iminumungkahing muling pagsulat ng bahaging ito.",
	"verdict.withheld.assessment_invalid": "Hindi nakahanay ang gawain sa pagtatasa, kaya ayusin muna ang pagtatasa; walang iminumungkahing muling pagsulat ng pahayag ng pagpapahalaga.",
	"verdict.withheld.values_classified": "Nasagot na ang tanong tungkol sa mga pagpapahalaga ng araling ito (tingnan ang VAL-05), kaya nananatili ang sagot nito at walang iminumungkahing muling pagsulat ng pahayag ng pagpapahalaga.",
	"verdict.withheld.content_sound": "Napatunayang bahagi ng kurso ang nilalaman ng linggong ito, kaya hindi ito isinusulat muli para umangkop sa ILO na ito; ang ILO ang dapat suriin.",
	"verdict.withheld.draft_review": "May nakitang posibleng walang batayan o kinopyang mga salita ang static na pagsusuri sa iminungkahing muling pagsulat, kaya hindi ito iniaalok at kailangang suriin ng guro. Hindi nagbabago ang akademikong pasya at ang iyong orihinal na teksto.",
	"verdict.withheld.retag_conflict": "Ayon sa mga sagot tungkol sa mga tag ng CLO na ito, maaaring manatili ang CLO gaya ng pagkakasulat, kaya hindi iniaalok ang muling pagsulat na ito; ikaw ang magpapasya kung ang CLO o ang mga tag nito ang babaguhin.",
	"verdict.withheld.clo_off_course": "Napagpasyahang hindi tungkol sa kurso ang CLO na ito (CLO-03), kaya uunahing isulat itong muli para sa kurso; walang muling pagsulat patungo sa isang PO o EGA na iniaalok hangga't hindi pa ito naitatama.",
	"verdict.msg.useApprovedValue": "Gamitin ang aprubadong halaga: {value}",
	"verdict.msg.valueRequired": "Linggo {week}: isama ang kahit isang pangunahing pagpapahalagang Marian-Augustinian.",
	"verdict.msg.selectCourse": "Piliin ang kursong ito mula sa aprubadong kurikulum ng programa. Hindi hinuhulaan ng tagasuri kung aling kurso ang tinutukoy.",
	"verdict.srv.apaDateMissing": "Walang nakitang petsa ng paglalathala sa anyong (2020). pagkatapos ng mga may-akda.",
	"verdict.srv.apaDatePeriod": "Dapat may tuldok pagkatapos ng petsa: ({date}).",
	"verdict.srv.apaDateRange": "Hindi kapani-paniwalang taon ng paglalathala ang {year}.",
	"verdict.srv.apaAuthorMissing": "Walang nauuna sa petsa. Kung walang may-akda ang akda, nagsisimula ang APA 7 sa pamagat; hindi sinusuri ng tagasuring ito ang anyong iyon.",
	"verdict.srv.apaAuthorPeriod": "Dapat magtapos sa tuldok ang bahagi ng may-akda bago ang petsa.",
	"verdict.srv.apaAuthorForm": "Wala sa anyong \"Apelyido, A. B.\" ang mga may-akda at hindi rin sila mukhang isang organisasyon.",
	"verdict.srv.apaAuthorAnd": "Sa APA 7, idinudugtong ang huling may-akda gamit ang \"&\", hindi \"and\".",
	"verdict.srv.apaAuthorComma": "Sa APA 7, may kuwit bago ang \"&\": \"Apelyido, A., & Apelyido, B.\"",
	"verdict.srv.apaAuthorAmpersand": "Higit sa isa ang may-akda ngunit walang \"&\" bago ang huli.",
	"verdict.srv.apaAuthorInitials": "Dapat may tuldok ang mga inisyal (\"Smith, J. K.\").",
	"verdict.srv.apaTitleMissing": "Walang nakitang pamagat pagkatapos ng petsa.",
	"verdict.srv.apaJournalVolume": "Kailangan ng artikulo sa journal ang pangalan ng journal at ang numero ng volume (nasa panaklong ang isyu).",
	"verdict.srv.apaJournalPages": "Kailangan ng artikulo sa journal ang saklaw ng pahina o ang numero ng artikulo.",
	"verdict.srv.apaJournalName": "Hindi nakita ang pangalan ng journal.",
	"verdict.srv.apaBookPublisher": "Kailangan ng aklat ang tagapaglathala nito.",
	"verdict.srv.apaBookLocation": "Hindi isinasama sa APA 7 ang lugar ng paglalathala.",
	"verdict.srv.apaChapterPages": "Kailangan ng kabanata sa inedit na aklat ang saklaw ng pahina nito, nakasulat bilang (pp. 10-25).",
	"verdict.srv.apaChapterPublisher": "Sinusundan ng tagapaglathala ng aklat ang kabanata sa inedit na aklat; walang nakilala.",
	"verdict.srv.apaReportPublisher": "Isinasaad ng ulat ang tagapaglathala nito maliban kung ito rin ang may-akda; walang nakita.",
	"verdict.srv.apaConfIn": "Isinasaad ng papel sa kumperensiya ang proceedings pagkatapos ng \"In\".",
	"verdict.srv.apaWebUrl": "Kailangan ng online na sanggunian ang URL nito.",
	"verdict.srv.apaRetrieved": "Sa APA 7, ginagamit lamang ang \"Retrieved from\" kasama ang petsa ng pagkuha, para sa mga pahinang sadyang nagbabago.",
	"verdict.srv.apaTitleQuotes": "Hindi inilalagay ng APA 7 sa panipi ang pamagat ng artikulo, kabanata o pahina.",
	"verdict.srv.apaAccessed": "Hindi istilong APA 7 ang \"Accessed\"; ginagamit ng APA 7 ang \"Retrieved Month Day, Year, from URL\" para lamang sa mga pahinang sadyang nagbabago.",
	"verdict.srv.apaDoiForm": "Isinusulat ang DOI bilang link: https://doi.org/{doi}",
	"verdict.srv.apaDoiMalformed": "Walang DOI na nasa anyong 10.xxxx/yyyy ang link ng DOI.",
	"verdict.srv.apaUrlHttp": "Gumagamit ang link ng http, hindi https: {url}",
	"verdict.srv.apaUrlMalformed": "Hindi wastong web address ang link na ito: {url}",
	"verdict.srv.apaUrlTwice": "Dalawang link ang ibinigay; isa lamang ang ibinibigay ng APA 7.",
	"verdict.srv.apaKindUnclear": "Hindi matukoy mula sa teksto ang uri ng sanggunian (aklat, artikulo, papel sa kumperensiya, website, opisyal na dokumento), kaya walang inilapat na panuntunang tiyak sa isang uri ng sanggunian.",
	"verdict.srv.refMechanical": "Mekanikal na pagwawasto (ginagamit lamang ang nasa sanggunian na): {text}",
	"verdict.srv.refAddMissing": "Idagdag ang kulang na bahagi ({parts}) nang eksakto gaya ng nasa mismong sanggunian.",
	"verdict.srv.refCorrectApa": "Iwasto ito ayon sa APA 7 para sa ganitong uri ng sanggunian, gamit lamang ang ipinapakita ng mismong sanggunian.",
	"verdict.srv.refNotVerified": "{count} sa {total} sanggunian ang hindi sinuri laban sa anumang panlabas na batayan, kaya hindi alam kung umiiral ang mga akda gaya ng pagkakabanggit. Hindi pinatutunayan ng tamang anyo na totoo ang sanggunian.",
	"verdict.srv.refDoiNotFound": "Hindi nakita sa Crossref ang DOI. Suriin ito laban sa sanggunian; walang ipinapasya tungkol sa akda.",
	"verdict.srv.refDoiMismatch": "Umiiral ang DOI ngunit nakarehistro ito sa ibang pamagat o taon{detail}. Suriin ang sanggunian laban sa pinagmulan.",
	"verdict.srv.valCopied": "Iisang pahayag ng pagpapahalaga ang nakasulat sa {count} sa {total} aralin (\"{text}\"). Hindi masasabi ng pagpapahalagang kinopya nang walang pagbabago kung paano ito isinasabuhay sa bawat aralin. Hindi kailangan ang isang pagpapahalaga sa bawat aralin, at hindi kailangang gamitin ng kurso ang lahat ng anim.",
	"verdict.srv.valCopiedFix": "Isulat ang pahayag ng pagpapahalaga ng bawat aralin batay sa ginagawa ng mga mag-aaral sa araling iyon; maaaring maulit ang pagpapahalaga, ngunit hindi ang paglalarawan nito.",
	"verdict.srv.valNotJudged": "Hindi mapagpasyahan kung isinasabuhay ang mga pagpapahalaga sa buong kurso: wala pang aralin na may napatunayang sagot. Mga pagpapahalagang nagamit sa ngayon: {values}.",
	"verdict.srv.valShare": "{count} sa {total} araling may nakasaad na pagpapahalaga ang hinatulang isinasabuhay ito (mga pagpapahalagang nakasaad: {values}). Ang bahagdang nagpapasuri ({percent}%) ay mungkahi, hindi aprubadong pamantayan ng institusyon; hindi kailangan ang isang pagpapahalaga sa bawat aralin.",
	"verdict.srv.valShareFix": "Tingnan ang mga araling hinatulang hindi isinasabuhay ang pahayag ng pagpapahalaga at ilarawan, para sa bawat isa, ang ginagawa ng mga mag-aaral na nagpapahayag ng pagpapahalaga.",
	"verdict.srv.valFitsPartly": "Bahagi lamang ng ginagawa ng mga mag-aaral sa araling ito ang tugma sa nakasaad na pagpapahalaga. {detail}",
	"verdict.srv.taskVague": "Hindi sinasabi ng gawain kung ano ang ginagawa o sinasagot. {detail}",
	"verdict.srv.taskBelow": "Mas mababa ang gawain sa antas ng ILO. {detail}",
	"verdict.srv.taskAbove": "Mas mataas ang gawain sa antas ng ILO. {detail}",
	"verdict.srv.contradicts": "Sumasalungat sa sarili ang sagot ng AI ({reason}), kaya ipinapakita lamang ito para suriin. {detail}",
	"verdict.srv.restsOnUnassessedPass": "Nakasalalay ang hatol sa hindi sinuri ng AI sa sagot na ito ({fields}), kaya ipinapakita ito para suriin at hindi ibinibilang na pasado. {detail}",
	"verdict.srv.restsOnUnassessedFail": "Nakasalalay ang hatol sa hindi sinuri ng AI sa sagot na ito ({fields}), kaya ipinapakita ito para suriin at hindi ibinibilang na bagsak. {detail}",
	"verdict.srv.aspectNotAssessed": "Hindi sinuri ng AI sa sagot na ito: {fields}. Kaya hindi nasuri ang panuntunang ito para sa araling ito.",
	"verdict.srv.noScopedCheck": "Wala pang tiyak na pagsusuri ng AI para sa panuntunang ito.",
	"verdict.srv.aiIncomplete": "Kailangan ng pagsusuri ng AI sa kahulugan, na hindi natapos.",
	"verdict.srv.approvalMeta": "Hindi pa sinusuri ang datos ng pag-apruba at rebisyon.",
	"verdict.srv.exportRendering": "Hindi pa sinusuri ang anyo ng na-export na dokumento.",
	"verdict.srv.gradingPolicy": "Walang nakatakdang aprubado at may bersiyong patakaran ng institusyon sa pagmamarka.",
	"verdict.srv.refAvailability": "Hindi pa hiwalay na sinusuri ang pagkakaroon at bersiyon ng sanggunian.",
	"verdict.srv.notApplicable": "Hindi naaangkop.",
	"verdict.srv.cloCountFix": "Hilingin sa administrador na itakda ang eksaktong {count} CLO para sa kursong ito.",
	"verdict.srv.cloCount": "May {count} CLO ang silabus; ang pamantayan ng institusyon ay eksaktong {total}.",
	"verdict.srv.iloMapping": "Itugma ang bawat ILO ng aralin sa kahit isang umiiral na CLO nang walang dobleng pagtutugma.",
	"verdict.srv.replaceFiller": "Palitan ito ng tunay na nilalaman ng kurso.",
	"verdict.srv.filler": "Pansamantala o pampunong teksto ang laman ng bahaging ito, kaya bilang itong napunan ngunit walang sinasabi.",
	"verdict.srv.orientationHint": "Binabanggit ng Linggo 1 ang nilalamang pang-oryentasyon (pahiwatig lamang mula sa mga salita); dapat kumpirmahin ng tagasuri na saklaw nito ang mga layunin, kahingian, pagmamarka at mga patakaran.",
	"verdict.srv.codeMismatch": "MALUBHANG HINDI PAGTUTUGMA: Wala ang Code ng Kurso na {code} sa opisyal na kurikulum ng {program}."
};
//#endregion
//#region src/i18n/pdfImport.js
const pdfImportEn = {
	"pdfImport.identityMismatch": "PDF course {code} cannot be verified as selected subject {selected} in its program and approved curriculum. Check the code, title and curriculum year, or select the matching subject.",
	"pdfImport.programReview": "The PDF does not state a program code. Confirm that it belongs to {program}; its code and title are checked within that program’s approved curriculum.",
	"pdfImport.prereqConflict": "The PDF prerequisite differs from the current draft. Choose which value to use.",
	"pdfImport.prereqExisting": "Current prerequisite: {value}",
	"pdfImport.prereqImported": "PDF prerequisite: {value}",
	"pdfImport.prereqKeep": "Keep the current prerequisite",
	"pdfImport.prereqReplace": "Replace with the PDF prerequisite",
	"pdfImport.prereqReviewRequired": "Choose whether to keep or replace the prerequisite before applying.",
	"pdfImport.iloMappingReview": "Week {week}, outcome {outcome}: check the boundary and CLO mapping with the faculty. No missing CLO tag was inferred.",
	"pdfImport.unresolvedMappings": "Some printed outcome numbers or ranges cannot be mapped. Correct them in the preview before applying; no missing mappings will be guessed.",
	"pdfImport.week": "Week / range",
	"pdfImport.actions": "Actions",
	"pdfImport.cell": "Row {row}: {field}",
	"pdfImport.sourcePages": "Source pages: {pages}",
	"pdfImport.tableNote": "Columns and rows were recovered from the PDF layout. Rows split across pages are joined. Check the text and mappings against the source before applying.",
	"pdfImport.layoutWarning": "Some table boundaries were ambiguous. Compare the rows below with the source PDF and correct missing or misplaced text.",
	"pdfImport.addRow": "Add learning-plan row",
	"pdfImport.removeRow": "Remove row",
	"pdfImport.sourceOutcomes": "Institutional and program text read from the PDF",
	"pdfImport.field.vision": "Vision",
	"pdfImport.field.mission": "Mission (lead statement and one bullet per item)",
	"pdfImport.field.egas": "Expected Graduate Attributes (EGA)",
	"pdfImport.field.pos": "Program Outcomes (PO)",
	"pdfImport.duplicateClos": "Duplicate CLO numbers were found. Correct them before applying so ILO mappings remain unambiguous.",
	"pdfImport.reviewRequired": "Confirm the review checkbox above before applying the imported text and running AI CHECK.",
	"pdfImport.availabilityLoading": "Checking PDF import availability. You can choose your file while this loads.",
	"pdfImport.availabilityFailed": "Could not check PDF import availability. Retry to enable extraction.",
	"pdfImport.retry": "Retry availability check",
	"pdfImport.readOnly": "This syllabus is read-only. Open an editable draft or a syllabus returned for revision to import a PDF.",
	"pdfImport.eyebrow": "Import a PDF",
	"pdfImport.title": "Turn your PDF into an editable syllabus",
	"pdfImport.intro": "Scan your PDF, review the extracted text, then choose Apply and AI CHECK to save it and check the syllabus. Nothing is submitted automatically.",
	"pdfImport.chooseSubject": "Choose your assigned subject before importing a PDF.",
	"pdfImport.choose": "Choose subject",
	"pdfImport.file": "Syllabus PDF (up to 10 MB and 30 pages)",
	"pdfImport.pdfPreview": "View selected PDF",
	"pdfImport.extract": "Scan PDF and preview",
	"pdfImport.checking": "Saving imported content and running AI CHECK…",
	"pdfImport.checked": "Imported syllabus checked. Review the results and AI Recommendations below.",
	"pdfImport.savedCheckFailed": "The imported draft was saved, but AI CHECK did not complete: {message}. Retry with the AI CHECK button.",
	"pdfImport.extracting": "Reading PDF; scanned pages may take longer…",
	"pdfImport.reviewTitle": "Review extracted content",
	"pdfImport.reviewNote": "Correct missing or uncertain text before applying. These sections replace the corresponding form fields, including CLOs and the learning plan. Labelled institutional/program columns are imported when recovered; otherwise current values are retained for review. Your selected subject stays unchanged.",
	"pdfImport.pages": "Read {count} pages, including {ocr} scanned pages.",
	"pdfImport.ocrReview": "Some pages used OCR. Carefully check numbers, outcome mappings, URLs and table columns against the PDF.",
	"pdfImport.sourceText": "View all extracted source text",
	"pdfImport.formatNote": "Use one CLO per line, with explicit mappings such as “PO: 1, 2 EGA: 1”. For each learning-plan row use six columns separated by |: week | ILO (CLO 1) | contents | activities | assessment | values. Put each grading component on its own line followed by its percentage.",
	"pdfImport.mappingCounts": "Ready to import: {clos} CLOs, {plan} learning-plan rows, {references} references and {grading} grading components.",
	"pdfImport.confirm": "I reviewed the extracted text and agree to replace these draft sections and run AI CHECK. I will complete any missing fields in the form.",
	"pdfImport.apply": "Apply and AI CHECK",
	"pdfImport.saved": "PDF content saved. Review the form and complete missing fields, then click AI CHECK when ready.",
	"pdfImport.missing": "No text found for section(s) {fields}. Complete these in the form.",
	"pdfImport.courseMismatch": "PDF course code {code} does not match selected subject {selected}. Choose the matching subject or correct an extraction error.",
	"pdfImport.titleMismatch": "The extracted course title differs from the selected subject. Verify the source; the official selected title will be kept.",
	"pdfImport.creditsReview": "Review lecture/laboratory units in Course Information. A total credit value does not specify how lecture and laboratory units are split.",
	"pdfImport.outcomesReview": "Review the source institution/program text, CLO wording, cognitive levels and PO/EGA mappings. Mappings not explicitly stated in the PDF are left empty.",
	"pdfImport.planReview": "Some learning-plan text could not be mapped into six columns. Correct the rows in this preview or complete them manually in Learning Plan using the source text.",
	"pdfImport.referencesReview": "Review reference grouping and mark unused groups as not applicable. URLs are checked only when you click AI CHECK.",
	"pdfImport.gradingReview": "Grading components are missing or do not total 100%. Correct them before submitting.",
	"pdfImport.chooseFile": "Choose a PDF file.",
	"pdfImport.tooLarge": "The PDF exceeds the 10 MB limit.",
	"pdfImport.invalid": "Upload a complete, valid PDF document.",
	"pdfImport.timeout": "PDF extraction took too long. Try a smaller or clearer PDF.",
	"pdfImport.unreadable": "The PDF could not be read completely. Try a clearer, unlocked PDF or fill the form manually.",
	"pdfImport.encrypted": "Password-protected PDFs cannot be imported. Upload an unlocked copy.",
	"pdfImport.tooManyPages": "The PDF exceeds the 30-page import limit.",
	"pdfImport.tooMuchText": "The PDF contains too much text. Import a smaller syllabus document.",
	"pdfImport.noSections": "The standard syllabus sections could not be identified. Use a PDF with section headers I–X, or fill the form manually.",
	"pdfImport.disabled": "PDF import is currently disabled. You can still fill the builder form.",
	"pdfImport.busy": "Another PDF import is running. Wait until it finishes before trying again.",
	"pdfImport.rateLimit": "Too many PDF import attempts. Try again later.",
	"pdfImport.draftChanged": "The draft changed after this preview started. Extract the PDF again before applying it.",
	"pdfImport.saveFailed": "The draft could not be saved. Resolve the save error before continuing.",
	"pdfImport.selectMatchingSubject": "Select the subject matching the PDF course code before applying.",
	"pdfImport.failed": "PDF import failed. Please try again.",
	"pdfImport.tooManyClos": "More than 20 CLO rows were detected. Correct wrapped lines in the preview before applying.",
	"pdfImport.field.code": "I. Course Code",
	"pdfImport.field.title": "II. Course Title",
	"pdfImport.field.description": "III. Course Description",
	"pdfImport.field.prereq": "IV. Pre-requisite",
	"pdfImport.field.credits": "V. Credit Units",
	"pdfImport.field.clos": "VI. Course Learning Outcomes",
	"pdfImport.field.plan": "VII. Learning Plan",
	"pdfImport.field.reqs": "VIII. Course Requirements",
	"pdfImport.field.refs": "IX. References",
	"pdfImport.field.grading": "X. Grading System"
};
const pdfImportTl = {
	"pdfImport.identityMismatch": "Hindi mapatunayan na ang kursong {code} sa PDF ay ang napiling {selected} sa programa at aprubadong kurikulum. Suriin ang code, pamagat at taon ng kurikulum, o piliin ang katugmang asignatura.",
	"pdfImport.programReview": "Walang program code sa PDF. Tiyaking para ito sa {program}; sinusuri ang code at pamagat sa aprubadong kurikulum ng programang iyon.",
	"pdfImport.prereqConflict": "Magkaiba ang prerequisite sa PDF at sa kasalukuyang burador. Piliin ang gagamiting halaga.",
	"pdfImport.prereqExisting": "Kasalukuyang prerequisite: {value}",
	"pdfImport.prereqImported": "Prerequisite sa PDF: {value}",
	"pdfImport.prereqKeep": "Panatilihin ang kasalukuyang prerequisite",
	"pdfImport.prereqReplace": "Palitan ng prerequisite mula sa PDF",
	"pdfImport.prereqReviewRequired": "Piliing panatilihin o palitan ang prerequisite bago ilapat.",
	"pdfImport.iloMappingReview": "Linggo {week}, layunin {outcome}: ipasuri sa guro ang hangganan at CLO mapping. Walang inimbentong CLO tag.",
	"pdfImport.unresolvedMappings": "May mga numero o saklaw ng layunin na hindi ma-map. Itama sa preview bago ilapat; hindi huhulaan ang kulang na mapping.",
	"pdfImport.week": "Linggo / saklaw",
	"pdfImport.actions": "Mga aksiyon",
	"pdfImport.cell": "Hanay {row}: {field}",
	"pdfImport.sourcePages": "Pinagmulang pahina: {pages}",
	"pdfImport.tableNote": "Kinuha ang mga hanay at kolum mula sa ayos ng PDF. Pinagdugtong ang mga hanay na nahati sa pahina. Ihambing ang teksto at mapping sa pinagmulan bago ilapat.",
	"pdfImport.layoutWarning": "May hindi tiyak na hangganan ng talahanayan. Ihambing ang mga hanay sa PDF at itama ang kulang o maling puwesto ng teksto.",
	"pdfImport.addRow": "Magdagdag ng hanay sa learning plan",
	"pdfImport.removeRow": "Alisin ang hanay",
	"pdfImport.sourceOutcomes": "Teksto ng institusyon at programa mula sa PDF",
	"pdfImport.field.vision": "Bisyon",
	"pdfImport.field.mission": "Misyon (panimula at isang bullet bawat aytem)",
	"pdfImport.field.egas": "Mga Inaasahang Katangian ng Nagtapos (EGA)",
	"pdfImport.field.pos": "Mga Layunin ng Programa (PO)",
	"pdfImport.duplicateClos": "May nauulit na numero ng CLO. Itama bago ilapat upang maging malinaw ang ILO mapping.",
	"pdfImport.reviewRequired": "Lagyan ng tsek ang kumpirmasyon sa itaas bago ilapat ang teksto at patakbuhin ang AI CHECK.",
	"pdfImport.availabilityLoading": "Sinusuri kung magagamit ang PDF import. Maaari ka nang pumili ng file habang naghihintay.",
	"pdfImport.availabilityFailed": "Hindi masuri kung magagamit ang PDF import. Subukan muli upang mapagana ang pagbasa.",
	"pdfImport.retry": "Subukan muli ang availability check",
	"pdfImport.readOnly": "Para sa pagbasa lamang ang silabus na ito. Magbukas ng nae-edit na burador o ibinalik para sa rebisyon upang mag-import ng PDF.",
	"pdfImport.eyebrow": "Mag-import ng PDF",
	"pdfImport.title": "Gawing nae-edit na silabus ang iyong PDF",
	"pdfImport.intro": "I-scan ang PDF at suriin ang teksto. Piliin ang Ilapat at AI CHECK upang i-save at suriin ang silabus. Walang awtomatikong pagsusumite.",
	"pdfImport.chooseSubject": "Piliin muna ang nakatalagang asignatura bago mag-import ng PDF.",
	"pdfImport.choose": "Pumili ng asignatura",
	"pdfImport.file": "PDF ng silabus (hanggang 10 MB at 30 pahina)",
	"pdfImport.pdfPreview": "Tingnan ang napiling PDF",
	"pdfImport.extract": "I-scan ang PDF at tingnan muna",
	"pdfImport.checking": "Sine-save ang nilalaman at nagpapatakbo ng AI CHECK…",
	"pdfImport.checked": "Nasuri ang na-import na silabus. Tingnan ang resulta at mga rekomendasyon ng AI.",
	"pdfImport.savedCheckFailed": "Na-save ang na-import na burador ngunit hindi natapos ang AI CHECK: {message}. Subukan muli gamit ang AI CHECK.",
	"pdfImport.extracting": "Binabasa ang PDF; maaaring mas matagal ang mga na-scan na pahina…",
	"pdfImport.reviewTitle": "Suriin ang nakuhang nilalaman",
	"pdfImport.reviewNote": "Itama ang kulang o di-tiyak na teksto bago ilapat. Papalitan nito ang kaukulang field, CLO at learning plan. I-i-import ang malinaw na kolum ng institusyon/programa; kung wala, pananatilihin ang kasalukuyang halaga para suriin. Hindi magbabago ang asignatura.",
	"pdfImport.pages": "Nabasa ang {count} pahina, kasama ang {ocr} na na-scan na pahina.",
	"pdfImport.ocrReview": "Gumamit ng OCR sa ilang pahina. Ihambing ang mga numero, outcome mapping, URL at hanay ng talahanayan sa PDF.",
	"pdfImport.sourceText": "Tingnan ang buong nakuhang teksto",
	"pdfImport.formatNote": "Isang CLO bawat linya na may tahasang mapping gaya ng “PO: 1, 2 EGA: 1”. Sa learning plan, gumamit ng anim na hanay na pinaghiwalay ng |: linggo | ILO (CLO 1) | nilalaman | gawain | pagtatasa | pagpapahalaga. Isang grading component bawat linya na sinusundan ng porsiyento.",
	"pdfImport.mappingCounts": "Handang i-import: {clos} CLO, {plan} hanay ng learning plan, {references} sanggunian at {grading} grading component.",
	"pdfImport.confirm": "Sinuri ko ang teksto at pumapayag akong palitan ang mga seksiyon at magpatakbo ng AI CHECK. Kukumpletuhin ko ang mga kulang sa form.",
	"pdfImport.apply": "Ilapat at AI CHECK",
	"pdfImport.saved": "Na-save ang nilalaman ng PDF. Suriin at kumpletuhin ang form, at pindutin ang AI CHECK kapag handa na.",
	"pdfImport.missing": "Walang nakuhang teksto sa seksiyon {fields}. Kumpletuhin ang mga ito sa form.",
	"pdfImport.courseMismatch": "Hindi tugma ang code na {code} sa napiling {selected}. Piliin ang tamang asignatura o itama ang pagkakabasa.",
	"pdfImport.titleMismatch": "Iba ang nakuhang pamagat sa napiling asignatura. Suriin ang pinagmulan; pananatilihin ang opisyal na pamagat.",
	"pdfImport.creditsReview": "Suriin ang lecture/laboratory units sa Impormasyon ng Kurso. Hindi tinutukoy ng kabuuang credit units ang paghahati ng lecture at laboratory.",
	"pdfImport.outcomesReview": "Suriin ang teksto ng institusyon/programa, CLO, antas ng pag-iisip at PO/EGA mapping. Walang ilalagay na mapping na hindi tahasang nasa PDF.",
	"pdfImport.planReview": "May teksto ng learning plan na hindi mailagay sa anim na hanay. Itama sa preview o kumpletuhin sa Learning Plan gamit ang pinagmulang teksto.",
	"pdfImport.referencesReview": "Suriin ang pangkat ng sanggunian at markahang hindi naaangkop ang mga hindi gamit. Susuriin lamang ang URL kapag pinindot ang AI CHECK.",
	"pdfImport.gradingReview": "Kulang ang grading component o hindi 100% ang kabuuan. Itama bago isumite.",
	"pdfImport.chooseFile": "Pumili ng PDF file.",
	"pdfImport.tooLarge": "Lampas sa 10 MB ang PDF.",
	"pdfImport.invalid": "Mag-upload ng kumpleto at wastong PDF.",
	"pdfImport.timeout": "Masyadong matagal basahin ang PDF. Subukan ang mas maliit o malinaw na PDF.",
	"pdfImport.unreadable": "Hindi mabasa nang buo ang PDF. Gumamit ng mas malinaw at walang password na PDF o manu-manong punan ang form.",
	"pdfImport.encrypted": "Hindi ma-import ang PDF na may password. Mag-upload ng kopyang walang password.",
	"pdfImport.tooManyPages": "Lampas sa 30 pahina ang PDF.",
	"pdfImport.tooMuchText": "Masyadong mahaba ang teksto ng PDF. Gumamit ng mas maliit na silabus.",
	"pdfImport.noSections": "Hindi matukoy ang mga karaniwang seksiyon. Gumamit ng PDF na may heading I–X o punan ang form.",
	"pdfImport.disabled": "Hindi pinagana ang PDF import. Maaari pa ring punan ang builder form.",
	"pdfImport.busy": "May kasalukuyang PDF import. Hintaying matapos bago subukan muli.",
	"pdfImport.rateLimit": "Masyadong maraming pagtatangka. Subukan muli mamaya.",
	"pdfImport.draftChanged": "Nagbago ang burador matapos simulan ang preview. Basahin muli ang PDF bago ilapat.",
	"pdfImport.saveFailed": "Hindi ma-save ang burador. Ayusin ang error sa pag-save bago magpatuloy.",
	"pdfImport.selectMatchingSubject": "Piliin ang asignaturang tugma sa code ng PDF bago ilapat.",
	"pdfImport.failed": "Hindi nagtagumpay ang PDF import. Subukan muli.",
	"pdfImport.tooManyClos": "Mahigit 20 CLO ang nakita. Ayusin ang mga naputol na linya bago ilapat.",
	"pdfImport.field.code": "I. Code ng Kurso",
	"pdfImport.field.title": "II. Pamagat ng Kurso",
	"pdfImport.field.description": "III. Paglalarawan ng Kurso",
	"pdfImport.field.prereq": "IV. Paunang Kinakailangang Kurso",
	"pdfImport.field.credits": "V. Credit Units",
	"pdfImport.field.clos": "VI. Mga Layunin sa Pagkatuto ng Kurso",
	"pdfImport.field.plan": "VII. Plano ng Pagkatuto",
	"pdfImport.field.reqs": "VIII. Mga Kinakailangan sa Kurso",
	"pdfImport.field.refs": "IX. Mga Sanggunian",
	"pdfImport.field.grading": "X. Sistema ng Pagmamarka"
};
//#endregion
//#region src/i18n/dashboardStats.js
const dashboardStatsEn = {
	"analytics.loading": "Reading the stored checks…",
	"analytics.empty": "No AI checks yet. Scores appear here once a syllabus has been checked.",
	"analytics.spreadTitle": "How syllabi scored",
	"analytics.spreadSubtitleAdmin": "Share of checked syllabi in each AI score band",
	"analytics.spreadSubtitleFaculty": "Share of your checked syllabi in each AI score band",
	"analytics.barsTitleAdmin": "Average AI score by program",
	"analytics.barsSubtitleAdmin": "Checked syllabi only",
	"analytics.barsTitleFaculty": "AI score of each syllabus",
	"analytics.barsSubtitleFaculty": "Your latest check of each syllabus",
	"analytics.insight.yourScoreTitle": "Your AI score",
	"analytics.insight.yourScoreText": "{avg}% average across {count} checked syllabi.",
	"analytics.insight.noScoreText": "No syllabus has an AI score yet. Run the check in step 7 of the builder.",
	"analytics.insight.pendingTitle": "Pending reviews",
	"analytics.insight.pendingText": "{count} syllabi are waiting for a decision.",
	"analytics.insight.attentionTitle": "Needs attention",
	"analytics.insight.attentionText": "{count} syllabi were returned for revision or rejected.",
	"analytics.insight.tipTitle": "Tip",
	"analytics.insight.tipText": "Use the check in step 7 of the builder to improve scores before submitting.",
	"analytics.insight.topProgramTitle": "Highest-scoring program",
	"analytics.insight.topProgramText": "{program} averages {avg}% across {count} checked syllabi.",
	"analytics.insight.weakAreaTitle": "Weakest area",
	"analytics.insight.weakAreaText": "{area} averages {avg}% across the checked syllabi.",
	"analytics.insight.uncheckedTitle": "Not checked yet",
	"analytics.insight.uncheckedText": "{count} submitted syllabi have no AI check yet.",
	"dashboard.stats.programChecked": "{checked} of {total} checked by AI · {approved} approved ({pct}%)",
	"dashboard.stats.programNone": "No AI checks yet · {approved} of {total} approved ({pct}%)",
	"dashboard.stats.avgHint": "Average of your latest AI checks",
	"dashboard.stats.noChecks": "No AI checks yet",
	"dashboard.stats.approvedHint": "{pct}% of your syllabi",
	"dashboard.stats.snapshotNote": "Average of the latest AI check of each syllabus.",
	"dashboard.stats.noScore": "No score yet"
};
const dashboardStatsTl = {
	"analytics.loading": "Binabasa ang mga naitalang pagsusuri…",
	"analytics.empty": "Wala pang pagsusuri ng AI. Lalabas dito ang mga marka kapag nasuri na ang isang silabus.",
	"analytics.spreadTitle": "Paano nagmarka ang mga silabus",
	"analytics.spreadSubtitleAdmin": "Bahagi ng mga nasuring silabus sa bawat antas ng marka ng AI",
	"analytics.spreadSubtitleFaculty": "Bahagi ng iyong mga nasuring silabus sa bawat antas ng marka ng AI",
	"analytics.barsTitleAdmin": "Karaniwang marka ng AI ayon sa programa",
	"analytics.barsSubtitleAdmin": "Mga nasuring silabus lamang",
	"analytics.barsTitleFaculty": "Marka ng AI ng bawat silabus",
	"analytics.barsSubtitleFaculty": "Ang huli mong pagsusuri sa bawat silabus",
	"analytics.insight.yourScoreTitle": "Ang iyong marka ng AI",
	"analytics.insight.yourScoreText": "{avg}% ang karaniwan sa {count} nasuring silabus.",
	"analytics.insight.noScoreText": "Wala pang marka ng AI ang anumang silabus. Patakbuhin ang pagsusuri sa hakbang 7 ng builder.",
	"analytics.insight.pendingTitle": "Mga nakabinbing pagsusuri",
	"analytics.insight.pendingText": "{count} silabus ang naghihintay ng desisyon.",
	"analytics.insight.attentionTitle": "Kailangang bigyang-pansin",
	"analytics.insight.attentionText": "{count} silabus ang ibinalik para baguhin o tinanggihan.",
	"analytics.insight.tipTitle": "Payo",
	"analytics.insight.tipText": "Gamitin ang pagsusuri sa hakbang 7 ng builder para pagbutihin ang marka bago magsumite.",
	"analytics.insight.topProgramTitle": "Programang may pinakamataas na marka",
	"analytics.insight.topProgramText": "{program} ay may karaniwang {avg}% sa {count} nasuring silabus.",
	"analytics.insight.weakAreaTitle": "Pinakamahinang bahagi",
	"analytics.insight.weakAreaText": "{area} ay may karaniwang {avg}% sa mga nasuring silabus.",
	"analytics.insight.uncheckedTitle": "Hindi pa nasusuri",
	"analytics.insight.uncheckedText": "{count} isinumiteng silabus ang wala pang pagsusuri ng AI.",
	"dashboard.stats.programChecked": "{checked} sa {total} ang nasuri ng AI · {approved} ang inaprubahan ({pct}%)",
	"dashboard.stats.programNone": "Wala pang pagsusuri ng AI · {approved} sa {total} ang inaprubahan ({pct}%)",
	"dashboard.stats.avgHint": "Karaniwan ng iyong mga huling pagsusuri ng AI",
	"dashboard.stats.noChecks": "Wala pang pagsusuri ng AI",
	"dashboard.stats.approvedHint": "{pct}% ng iyong mga silabus",
	"dashboard.stats.snapshotNote": "Karaniwan ng huling pagsusuri ng AI sa bawat silabus.",
	"dashboard.stats.noScore": "Wala pang marka"
};
//#endregion
//#region src/i18n/index.js
const en = {
	...en$1,
	...extraEn,
	...hybridEn,
	...pdfImportEn,
	...dashboardStatsEn
};
const tl = {
	...tl$1,
	...extraTl,
	...hybridTl,
	...pdfImportTl,
	...dashboardStatsTl
};
const dictionaries = {
	en,
	tl
};
function translate(key, values = {}, language = getLanguage()) {
	return (dictionaries[language]?.[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
const t$3 = translate;
const messageKeys = /* @__PURE__ */ new Map();
for (const dictionary of [en, tl]) for (const [key, text] of Object.entries(dictionary)) messageKeys.set(text.trim(), key);
const escapeRegex = (text) => text.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
const patterns = [];
for (const dictionary of [en, tl]) for (const [key, text] of Object.entries(dictionary)) {
	if (!/\{\w+\}/.test(text)) continue;
	const names = [];
	let cursor = 0;
	let expression = "^";
	for (const match of text.matchAll(/\{(\w+)\}/g)) {
		const numeric = [
			"count",
			"number",
			"total",
			"score",
			"words",
			"rows",
			"row",
			"week",
			"ilo"
		].includes(match[1]);
		expression += escapeRegex(text.slice(cursor, match.index)) + (numeric ? "([\\d.,–\\s-]+)" : "(.*?)");
		names.push(match[1]);
		cursor = match.index + match[0].length;
	}
	expression += escapeRegex(text.slice(cursor)) + "$";
	const specificity = text.replace(/\{\w+\}/g, "").length;
	if (specificity >= 12 || names.every((name) => [
		"count",
		"number",
		"total",
		"score",
		"words",
		"rows",
		"row",
		"week",
		"ilo"
	].includes(name)) || /^(Showing|Since|Until|Step) /.test(en[key])) patterns.push({
		key,
		names,
		regex: new RegExp(expression, "s"),
		specificity
	});
}
patterns.sort((a, b) => b.specificity - a.specificity);
function tr(message) {
	if (typeof message !== "string" || !message) return message;
	const exact = messageKeys.get(message.trim());
	if (exact) return translate(exact).trim();
	const used = /^(.*)\. Remove those tags first\.$/s.exec(message);
	if (used) return used[1].split("; ").map(tr).join("; ") + ". " + tr("Remove those tags first.");
	const grouped = /^(.*) (\d+) more like this\.$/s.exec(message);
	if (grouped) return tr(grouped[1]) + " " + tr(grouped[2] + " more like this.");
	for (const { key, names, regex } of patterns) {
		const match = regex.exec(message);
		if (match) return translate(key, Object.fromEntries(names.map((name, i) => [name, name === "gaps" || name === "fields" ? match[i + 1].split(", ").map(tr).join(", ") : [
			"where",
			"which",
			"missing",
			"term",
			"problem",
			"hours",
			"message",
			"title",
			"status"
		].includes(name) ? tr(match[i + 1]) : match[i + 1]])));
	}
	return message;
}
function labelVariants(message) {
	if (typeof message !== "string") return [];
	const key = messageKeys.get(message.trim());
	if (!key) return [message];
	return [...new Set(["en", "tl"].map((language) => translate(key, {}, language).trim()))];
}
//#endregion
//#region src/components/StableButton.jsx
function StableLabel({ children }) {
	if (typeof children !== "string" || !children.trim()) return children;
	const variants = labelVariants(children);
	if (variants.length < 2) return children;
	return /* @__PURE__ */ jsxs("span", {
		className: "stable-label",
		children: [/* @__PURE__ */ jsx("span", {
			className: "stable-label-current",
			children
		}), variants.map((text, index) => /* @__PURE__ */ jsx("span", {
			className: "stable-label-reserve",
			"aria-hidden": "true",
			children: text
		}, index))]
	});
}
const StableButton = forwardRef(function StableButton({ children, ...props }, ref) {
	return /* @__PURE__ */ jsx("button", {
		...props,
		ref,
		children: Children.map(children, (child) => typeof child === "string" ? /* @__PURE__ */ jsx(StableLabel, { children: child }) : child)
	});
});
//#endregion
//#region node_modules/@phosphor-icons/react/dist/lib/context.es.js
const o$15 = createContext({
	color: "currentColor",
	size: "1em",
	weight: "regular",
	mirrored: !1
});
//#endregion
//#region node_modules/@phosphor-icons/react/dist/lib/IconBase.es.js
const p$3 = e$30.forwardRef((s, a) => {
	const { alt: n, color: r, size: t, weight: o, mirrored: c, children: i, weights: m, ...x } = s, { color: d = "currentColor", size: l, weight: f = "regular", mirrored: g = !1, ...w } = e$30.useContext(o$15);
	return /* @__PURE__ */ e$30.createElement("svg", {
		ref: a,
		xmlns: "http://www.w3.org/2000/svg",
		width: t != null ? t : l,
		height: t != null ? t : l,
		fill: r != null ? r : d,
		viewBox: "0 0 256 256",
		transform: c || g ? "scale(-1, 1)" : void 0,
		...w,
		...x
	}, !!n && /* @__PURE__ */ e$30.createElement("title", null, n), i, m.get(o != null ? o : f));
});
p$3.displayName = "IconBase";
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/LockSimple.es.js
const e$29 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,76H180V56A52,52,0,0,0,76,56V76H48A20,20,0,0,0,28,96V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V96A20,20,0,0,0,208,76ZM100,56a28,28,0,0,1,56,0V76H100ZM204,204H52V100H204Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H208A8,8,0,0,1,216,96Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,82H174V56a46,46,0,0,0-92,0V82H48A14,14,0,0,0,34,96V208a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V96A14,14,0,0,0,208,82ZM94,56a34,34,0,0,1,68,0V82H94ZM210,208a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V96a2,2,0,0,1,2-2H208a2,2,0,0,1,2,2Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,84H172V56a44,44,0,0,0-88,0V84H48A12,12,0,0,0,36,96V208a12,12,0,0,0,12,12H208a12,12,0,0,0,12-12V96A12,12,0,0,0,208,84ZM92,56a36,36,0,0,1,72,0V84H92ZM212,208a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V96a4,4,0,0,1,4-4H208a4,4,0,0,1,4,4Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/LockSimple.es.js
const e$28 = e$30.forwardRef((m, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...m,
	weights: e$29
}));
e$28.displayName = "LockSimpleIcon";
const p$2 = e$28;
//#endregion
//#region src/lib/api.js
const API = {}.VITE_API_URL || "http://localhost:3001/api";
API.replace(/\/api\/?$/, "");
const TOKEN_KEY = "sms_jwt";
const tokenStore = {
	get: () => {
		try {
			return localStorage.getItem(TOKEN_KEY);
		} catch {
			return null;
		}
	},
	set: (t) => {
		try {
			localStorage.setItem(TOKEN_KEY, t);
		} catch {}
	},
	clear: () => {
		try {
			localStorage.removeItem(TOKEN_KEY);
		} catch {}
	}
};
function authHeaders(extra = {}) {
	const token = tokenStore.get();
	return token ? {
		...extra,
		Authorization: `Bearer ${token}`
	} : extra;
}
let passwordChangeHandler = null;
async function request(path, options = {}) {
	let res;
	try {
		res = await fetch(`${API}${path}`, {
			credentials: "include",
			...options,
			headers: authHeaders({
				"Content-Type": "application/json",
				...options.headers
			})
		});
	} catch {
		throw new Error("Cannot reach the server. Check that the API is running and try again.");
	}
	const data = await res.json().catch(() => ({}));
	if (res.status === 401) tokenStore.clear();
	if (res.status === 403 && data.code === "password_change_required" && passwordChangeHandler);
	if (!res.ok) throw Object.assign(new Error(tr(data.message || data.error) || `Request failed (${res.status})`), {
		status: res.status,
		data
	});
	return data;
}
const syllabi = {
	pdfImportConfig: ({ signal } = {}) => request("/syllabi/pdf-import/config", { signal }),
	importPdf: async (id, file) => {
		const body = new FormData();
		body.append("file", file);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15e4);
		try {
			const res = await fetch(`${API}/syllabi/${id}/import-pdf`, {
				method: "POST",
				credentials: "include",
				headers: authHeaders(),
				body,
				signal: controller.signal
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw Object.assign(new Error(data.error || "pdfImport.failed"), {
				status: res.status,
				data
			});
			if (!data.fields || !Array.isArray(data.pages)) throw new Error("pdfImport.failed");
			return data;
		} catch (error) {
			if (error.name === "AbortError") throw new Error("pdfImport.timeout");
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	},
	list: () => request("/syllabi"),
	repository: () => request("/syllabi?scope=repository"),
	archived: (scope) => request("/syllabi?archived=1" + (scope === "repository" ? "&scope=repository" : "")),
	create: (formData) => fetch(`${API}/syllabi`, {
		method: "POST",
		credentials: "include",
		headers: authHeaders(),
		body: formData
	}).then((r) => r.json()),
	update: (id, data) => fetch(`${API}/syllabi/${id}`, {
		method: "PUT",
		credentials: "include",
		headers: authHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify(data)
	}).then((r) => r.json()),
	remove: (id) => request(`/syllabi/${id}`, { method: "DELETE" }),
	edit: async (id, formData) => {
		let res;
		try {
			res = await fetch(`${API}/syllabi/${id}`, {
				method: "PUT",
				credentials: "include",
				headers: authHeaders(),
				body: formData
			});
		} catch {
			throw new Error("Cannot reach the server. Check that the API is running and try again.");
		}
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(tr(data.message || data.error) || `Save failed (${res.status})`);
		return data;
	},
	versions: (id) => request(`/syllabi/${id}/versions`),
	review: (id, versionId) => request(`/syllabi/${id}/review${versionId ? "?version=" + versionId : ""}`),
	comments: (id) => request(`/syllabi/${id}/comments`),
	commentSummary: () => request("/syllabi/comment-summary"),
	markCommentsRead: (id) => request(`/syllabi/${id}/comments/read`, { method: "POST" }),
	addComment: (id, text) => request(`/syllabi/${id}/comments`, {
		method: "POST",
		body: JSON.stringify({ text })
	}),
	createDraft: () => request("/syllabi/drafts", { method: "POST" }),
	getContent: (id) => request(`/syllabi/${id}/content`),
	prepareCheck: (id) => request(`/syllabi/${id}/prepare-check`, { method: "POST" }),
	resumeDraft: (id) => request(`/syllabi/${id}/resume-draft`, { method: "POST" }),
	publishContent: (id, note, reviewedRunId) => request(`/syllabi/${id}/publish`, {
		method: "POST",
		body: JSON.stringify({
			note,
			reviewedRunId
		})
	}),
	submitContent: (id, note) => request(`/syllabi/${id}/submit`, {
		method: "POST",
		body: JSON.stringify({ note })
	}),
	saveContent: (id, sections, schemaVersion) => request(`/syllabi/${id}/content`, {
		method: "PUT",
		body: JSON.stringify({
			sections,
			schemaVersion
		})
	})
};
const compliance = {
	get: (id) => request(`/syllabi/${id}/compliance`),
	recheck: (id, force = false) => request(`/syllabi/${id}/compliance/recheck`, {
		method: "POST",
		body: JSON.stringify(force ? { force: true } : {})
	}),
	list: (syllabus = "all") => request(`/compliance?syllabus=${encodeURIComponent(syllabus)}`),
	history: ({ limit, from, to } = {}) => {
		const q = new URLSearchParams();
		if (limit) q.set("limit", limit);
		if (from) q.set("from", from);
		if (to) q.set("to", to);
		return request(`/compliance/history${q.toString() ? `?${q}` : ""}`);
	},
	run: (runId) => request(`/compliance/runs/${encodeURIComponent(runId)}`)
};
const outcomes = {
	institution: () => request("/institution/outcomes"),
	programs: () => request("/programs"),
	renameProgram: (id, name, expectedName, code, expectedCode) => request(`/programs/${id}`, {
		method: "PATCH",
		body: JSON.stringify({
			name,
			expectedName,
			code,
			expectedCode
		})
	}),
	previewProgramDeletion: (id) => request(`/programs/${id}/deletion-preview`),
	deleteProgram: (id, confirmation) => request(`/programs/${id}`, {
		method: "DELETE",
		body: JSON.stringify(confirmation)
	}),
	program: (code) => request(`/programs/${encodeURIComponent(code)}/outcomes`),
	saveInstitution: (body) => request("/institution/outcomes", {
		method: "PUT",
		body: JSON.stringify(body)
	}),
	saveProgram: (code, pos, version) => request(`/programs/${encodeURIComponent(code)}/outcomes`, {
		method: "PUT",
		body: JSON.stringify({
			pos,
			version
		})
	}),
	saveProgramEgas: (code, egas, version) => request(`/programs/${encodeURIComponent(code)}/egas`, {
		method: "PUT",
		body: JSON.stringify({
			egas,
			version
		})
	})
};
const courses$1 = {
	saveStandards: (id, section, value, version) => request(`/courses/${id}/standards`, {
		method: "PUT",
		body: JSON.stringify({
			section,
			value,
			version
		})
	}),
	list: (program, forSyllabus) => request(`/courses?${[program ? `program=${encodeURIComponent(program)}` : "", forSyllabus ? `taken=1&except=${Number(forSyllabus.except) || 0}` : ""].filter(Boolean).join("&")}`),
	get: (id) => request(`/courses/${id}`),
	create: (data) => request("/courses", {
		method: "POST",
		body: JSON.stringify(data)
	}),
	update: (id, data) => request(`/courses/${id}`, {
		method: "PUT",
		body: JSON.stringify(data)
	}),
	remove: (id) => request(`/courses/${id}`, { method: "DELETE" }),
	saveClos: (id, clos, version) => request(`/courses/${id}/clos`, {
		method: "PUT",
		body: JSON.stringify({
			clos,
			version
		})
	})
};
const syllabusCheck = {
	status: () => request("/syllabus-check/status"),
	decisions: (runId) => request(`/syllabus-check/runs/${runId}/decisions`),
	refine: (runId, suggestionId) => request(`/syllabus-check/runs/${runId}/suggestions/${encodeURIComponent(suggestionId)}/refine`, { method: "POST" }),
	decide: (runId, body) => request(`/syllabus-check/runs/${runId}/decisions`, {
		method: "POST",
		body: JSON.stringify(body)
	})
};
const users = {
	updatePreferences: (preferredLanguage) => request("/users/me/preferences", {
		method: "PATCH",
		body: JSON.stringify({ preferredLanguage })
	}),
	updateProfile: (data) => request("/users/me/profile", {
		method: "PATCH",
		body: JSON.stringify(data)
	}),
	syncGoogleAvatar: (token) => request("/users/me/avatar/google", {
		method: "POST",
		body: JSON.stringify({ token })
	}),
	syncGoogleAvatarWithAccessToken: (accessToken) => request("/users/me/avatar/google", {
		method: "POST",
		body: JSON.stringify({ accessToken })
	}),
	list: () => request("/users"),
	create: (data) => request("/users", {
		method: "POST",
		body: JSON.stringify(data)
	}),
	remove: (id) => request(`/users/${id}`, { method: "DELETE" }),
	resendCredentials: (id) => request(`/users/${id}/resend-credentials`, { method: "POST" }),
	myAssignments: () => request("/users/me/assignments"),
	assignments: (id) => request(`/users/${id}/assignments`),
	subjectHolders: () => request("/users/subject-holders"),
	saveAssignments: (id, body) => request(`/users/${id}/assignments`, {
		method: "PUT",
		body: JSON.stringify(body)
	}),
	uploadAvatar: async (file) => {
		const body = new FormData();
		body.append("avatar", file);
		let res;
		try {
			res = await fetch(`${API}/users/me/avatar`, {
				method: "POST",
				credentials: "include",
				headers: authHeaders(),
				body
			});
		} catch {
			throw new Error("Cannot reach the server. Check that the API is running and try again.");
		}
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(tr(data.message || data.error) || `Upload failed (${res.status})`);
		return data;
	},
	removeAvatar: () => request("/users/me/avatar", { method: "DELETE" })
};
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Notebook.es.js
const e$27 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M108,108a12,12,0,0,1,12-12h56a12,12,0,0,1,0,24H120A12,12,0,0,1,108,108Zm68,28H120a12,12,0,0,0,0,24h56a12,12,0,0,0,0-24Zm52-88V208a20,20,0,0,1-20,20H48a20,20,0,0,1-20-20V48A20,20,0,0,1,48,28H208A20,20,0,0,1,228,48ZM52,204H68V52H52ZM204,52H92V204H204Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M80,40V216H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M184,112a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h64A8,8,0,0,1,184,112Zm-8,24H112a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm48-88V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM48,208H72V48H48Zm160,0V48H88V208H208Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM80,208H48V48H80Zm96-56H112a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H112a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M182,112a6,6,0,0,1-6,6H112a6,6,0,0,1,0-12h64A6,6,0,0,1,182,112Zm-6,26H112a6,6,0,0,0,0,12h64a6,6,0,0,0,0-12Zm46-90V208a14,14,0,0,1-14,14H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34H208A14,14,0,0,1,222,48ZM48,210H74V46H48a2,2,0,0,0-2,2V208A2,2,0,0,0,48,210ZM210,48a2,2,0,0,0-2-2H86V210H208a2,2,0,0,0,2-2Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M184,112a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h64A8,8,0,0,1,184,112Zm-8,24H112a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm48-88V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM48,208H72V48H48Zm160,0V48H88V208H208Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M180,112a4,4,0,0,1-4,4H112a4,4,0,0,1,0-8h64A4,4,0,0,1,180,112Zm-4,28H112a4,4,0,0,0,0,8h64a4,4,0,0,0,0-8Zm44-92V208a12,12,0,0,1-12,12H48a12,12,0,0,1-12-12V48A12,12,0,0,1,48,36H208A12,12,0,0,1,220,48ZM48,212H76V44H48a4,4,0,0,0-4,4V208A4,4,0,0,0,48,212ZM212,48a4,4,0,0,0-4-4H84V212H208a4,4,0,0,0,4-4Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Notebook.es.js
const e$26 = e$30.forwardRef((t, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...t,
	weights: e$27
}));
e$26.displayName = "NotebookIcon";
const n$6 = e$26;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ArrowUpRight.es.js
const a$9 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M192,64V168L88,64Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M192,56H88a8,8,0,0,0-5.66,13.66L128.69,116,58.34,186.34a8,8,0,0,0,11.32,11.32L140,127.31l46.34,46.35A8,8,0,0,0,200,168V64A8,8,0,0,0,192,56Zm-8,92.69-38.34-38.34h0L107.31,72H184Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,64V168a8,8,0,0,1-13.66,5.66L140,127.31,69.66,197.66a8,8,0,0,1-11.32-11.32L128.69,116,82.34,69.66A8,8,0,0,1,88,56H192A8,8,0,0,1,200,64Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M198,64V168a6,6,0,0,1-12,0V78.48L68.24,196.24a6,6,0,0,1-8.48-8.48L177.52,70H88a6,6,0,0,1,0-12H192A6,6,0,0,1,198,64Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M196,64V168a4,4,0,0,1-8,0V73.66L66.83,194.83a4,4,0,0,1-5.66-5.66L182.34,68H88a4,4,0,0,1,0-8H192A4,4,0,0,1,196,64Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ArrowUpRight.es.js
const r$5 = e$30.forwardRef((t, e) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: e,
	...t,
	weights: a$9
}));
r$5.displayName = "ArrowUpRightIcon";
const c$7 = r$5;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ArrowUUpLeft.es.js
const e$25 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M236,144a68.07,68.07,0,0,1-68,68H80a12,12,0,0,1,0-24h88a44,44,0,0,0,0-88H61l27.52,27.51a12,12,0,0,1-17,17l-48-48a12,12,0,0,1,0-17l48-48a12,12,0,1,1,17,17L61,76H168A68.08,68.08,0,0,1,236,144Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M80,40v96L32,88Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M168,80H88V40a8,8,0,0,0-13.66-5.66l-48,48a8,8,0,0,0,0,11.32l48,48A8,8,0,0,0,88,136V96h80a48,48,0,0,1,0,96H80a8,8,0,0,0,0,16h88a64,64,0,0,0,0-128ZM72,116.69,43.31,88,72,59.31Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M232,144a64.07,64.07,0,0,1-64,64H80a8,8,0,0,1,0-16h88a48,48,0,0,0,0-96H88v40a8,8,0,0,1-13.66,5.66l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,88,40V80h80A64.07,64.07,0,0,1,232,144Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M230,144a62.07,62.07,0,0,1-62,62H80a6,6,0,0,1,0-12h88a50,50,0,0,0,0-100H46.49l37.75,37.76a6,6,0,1,1-8.48,8.48l-48-48a6,6,0,0,1,0-8.48l48-48a6,6,0,0,1,8.48,8.48L46.49,82H168A62.07,62.07,0,0,1,230,144Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M232,144a64.07,64.07,0,0,1-64,64H80a8,8,0,0,1,0-16h88a48,48,0,0,0,0-96H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,45.66L51.31,80H168A64.07,64.07,0,0,1,232,144Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228,144a60.07,60.07,0,0,1-60,60H80a4,4,0,0,1,0-8h88a52,52,0,0,0,0-104H41.66l41.17,41.17a4,4,0,0,1-5.66,5.66l-48-48a4,4,0,0,1,0-5.66l48-48a4,4,0,0,1,5.66,5.66L41.66,84H168A60.07,60.07,0,0,1,228,144Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ArrowUUpLeft.es.js
const r$4 = e$30.forwardRef((e, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...e,
	weights: e$25
}));
r$4.displayName = "ArrowUUpLeftIcon";
const c$6 = r$4;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/XCircle.es.js
const a$8 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M164.24,100.24,136.48,128l27.76,27.76a6,6,0,1,1-8.48,8.48L128,136.48l-27.76,27.76a6,6,0,0,1-8.48-8.48L119.52,128,91.76,100.24a6,6,0,0,1,8.48-8.48L128,119.52l27.76-27.76a6,6,0,0,1,8.48,8.48ZM230,128A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M162.83,98.83,133.66,128l29.17,29.17a4,4,0,0,1-5.66,5.66L128,133.66,98.83,162.83a4,4,0,0,1-5.66-5.66L122.34,128,93.17,98.83a4,4,0,0,1,5.66-5.66L128,122.34l29.17-29.17a4,4,0,1,1,5.66,5.66ZM228,128A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/XCircle.es.js
const o$14 = e$30.forwardRef((r, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...r,
	weights: a$8
}));
o$14.displayName = "XCircleIcon";
const s$9 = o$14;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ChatCircleText.es.js
const e$24 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M172,108a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,108Zm-12,28H96a12,12,0,0,0,0,24h64a12,12,0,0,0,0-24Zm76-8A108,108,0,0,1,78.77,224.15L46.34,235A20,20,0,0,1,21,209.66l10.81-32.43A108,108,0,1,1,236,128Zm-24,0A84,84,0,1,0,55.27,170.06a12,12,0,0,1,1,9.81l-9.93,29.79,29.79-9.93a12.1,12.1,0,0,1,3.8-.62,12,12,0,0,1,6,1.62A84,84,0,0,0,212,128Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M224,128A96,96,0,0,1,79.93,211.11h0L42.54,223.58a8,8,0,0,1-10.12-10.12l12.47-37.39h0A96,96,0,1,1,224,128Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-4-1.08,7.85,7.85,0,0,0-2.53.42L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Zm40-104a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,144Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M166,112a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,112Zm-6,26H96a6,6,0,0,0,0,12h64a6,6,0,0,0,0-12Zm70-10A102,102,0,0,1,79.31,217.65L44.44,229.27a14,14,0,0,1-17.71-17.71l11.62-34.87A102,102,0,1,1,230,128Zm-12,0A90,90,0,1,0,50.08,173.06a6,6,0,0,1,.5,4.91L38.12,215.35a2,2,0,0,0,2.53,2.53L78,205.42a6.2,6.2,0,0,1,1.9-.31,6.09,6.09,0,0,1,3,.81A90,90,0,0,0,218,128Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M168,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm-8,24H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm72-8A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M164,112a4,4,0,0,1-4,4H96a4,4,0,0,1,0-8h64A4,4,0,0,1,164,112Zm-4,28H96a4,4,0,0,0,0,8h64a4,4,0,0,0,0-8Zm68-12A100,100,0,0,1,79.5,215.47l-35.69,11.9a12,12,0,0,1-15.18-15.18l11.9-35.69A100,100,0,1,1,228,128Zm-8,0A92,92,0,1,0,48.35,174.07a4,4,0,0,1,.33,3.27L36.22,214.72a4,4,0,0,0,5.06,5.06l37.38-12.46a3.93,3.93,0,0,1,1.27-.21,4.05,4.05,0,0,1,2,.54A92,92,0,0,0,220,128Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ChatCircleText.es.js
const t$2 = e$30.forwardRef((o, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...o,
	weights: e$24
}));
t$2.displayName = "ChatCircleTextIcon";
const s$8 = t$2;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ClockCounterClockwise.es.js
const e$23 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M140,80v41.21l34.17,20.5a12,12,0,1,1-12.34,20.58l-40-24A12,12,0,0,1,116,128V80a12,12,0,0,1,24,0ZM128,28A99.38,99.38,0,0,0,57.24,57.34c-4.69,4.74-9,9.37-13.24,14V64a12,12,0,0,0-24,0v40a12,12,0,0,0,12,12H72a12,12,0,0,0,0-24H57.77C63,86,68.37,80.22,74.26,74.26a76,76,0,1,1,1.58,109,12,12,0,0,0-16.48,17.46A100,100,0,1,0,128,28Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,128A96,96,0,0,1,62.11,197.82a8,8,0,1,1,11-11.64A80,80,0,1,0,71.43,71.43C67.9,75,64.58,78.51,61.35,82L77.66,98.34A8,8,0,0,1,72,112H32a8,8,0,0,1-8-8V64a8,8,0,0,1,13.66-5.66L50,70.7c3.22-3.49,6.54-7,10.06-10.55A96,96,0,0,1,224,128ZM128,72a8,8,0,0,0-8,8v48a8,8,0,0,0,3.88,6.86l40,24a8,8,0,1,0,8.24-13.72L136,123.47V80A8,8,0,0,0,128,72Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M134,80v44.6l37.09,22.25a6,6,0,0,1-6.18,10.3l-40-24A6,6,0,0,1,122,128V80a6,6,0,0,1,12,0Zm-6-46A93.4,93.4,0,0,0,61.51,61.56c-8.58,8.68-16,17-23.51,25.8V64a6,6,0,0,0-12,0v40a6,6,0,0,0,6,6H72a6,6,0,0,0,0-12H44.73C52.86,88.29,60.79,79.35,70,70a82,82,0,1,1,1.7,117.62,6,6,0,1,0-8.24,8.72A94,94,0,1,0,128,34Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M132,80v45.74l38.06,22.83a4,4,0,0,1-4.12,6.86l-40-24A4,4,0,0,1,124,128V80a4,4,0,0,1,8,0Zm-4-44A91.42,91.42,0,0,0,62.93,63C53.05,73,44.66,82.47,36,92.86V64a4,4,0,0,0-8,0v40a4,4,0,0,0,4,4H72a4,4,0,0,0,0-8H40.47C49.61,89,58.3,79,68.6,68.6a84,84,0,1,1,1.75,120.49,4,4,0,1,0-5.5,5.82A92,92,0,1,0,128,36Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ClockCounterClockwise.es.js
const e$22 = e$30.forwardRef((c, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...c,
	weights: e$23
}));
e$22.displayName = "ClockCounterClockwiseIcon";
const a$7 = e$22;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/SealCheck.es.js
const s$7 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228.75,100.05c-3.52-3.67-7.15-7.46-8.34-10.33-1.06-2.56-1.14-7.83-1.21-12.47-.15-10-.34-22.44-9.18-31.27s-21.27-9-31.27-9.18c-4.64-.07-9.91-.15-12.47-1.21-2.87-1.19-6.66-4.82-10.33-8.34C148.87,20.46,140.05,12,128,12s-20.87,8.46-27.95,15.25c-3.67,3.52-7.46,7.15-10.33,8.34-2.56,1.06-7.83,1.14-12.47,1.21C67.25,37,54.81,37.14,46,46S37,67.25,36.8,77.25c-.07,4.64-.15,9.91-1.21,12.47-1.19,2.87-4.82,6.66-8.34,10.33C20.46,107.13,12,116,12,128S20.46,148.87,27.25,156c3.52,3.67,7.15,7.46,8.34,10.33,1.06,2.56,1.14,7.83,1.21,12.47.15,10,.34,22.44,9.18,31.27s21.27,9,31.27,9.18c4.64.07,9.91.15,12.47,1.21,2.87,1.19,6.66,4.82,10.33,8.34C107.13,235.54,116,244,128,244s20.87-8.46,27.95-15.25c3.67-3.52,7.46-7.15,10.33-8.34,2.56-1.06,7.83-1.14,12.47-1.21,10-.15,22.44-.34,31.27-9.18s9-21.27,9.18-31.27c.07-4.64.15-9.91,1.21-12.47,1.19-2.87,4.82-6.66,8.34-10.33C235.54,148.87,244,140.05,244,128S235.54,107.13,228.75,100.05Zm-17.32,39.29c-4.82,5-10.28,10.72-13.19,17.76-2.82,6.8-2.93,14.16-3,21.29-.08,5.36-.19,12.71-2.15,14.66s-9.3,2.07-14.66,2.15c-7.13.11-14.49.22-21.29,3-7,2.91-12.73,8.37-17.76,13.19C135.78,214.84,130.4,220,128,220s-7.78-5.16-11.34-8.57c-5-4.82-10.72-10.28-17.76-13.19-6.8-2.82-14.16-2.93-21.29-3-5.36-.08-12.71-.19-14.66-2.15s-2.07-9.3-2.15-14.66c-.11-7.13-.22-14.49-3-21.29-2.91-7-8.37-12.73-13.19-17.76C41.16,135.78,36,130.4,36,128s5.16-7.78,8.57-11.34c4.82-5,10.28-10.72,13.19-17.76,2.82-6.8,2.93-14.16,3-21.29C60.88,72.25,61,64.9,63,63s9.3-2.07,14.66-2.15c7.13-.11,14.49-.22,21.29-3,7-2.91,12.73-8.37,17.76-13.19C120.22,41.16,125.6,36,128,36s7.78,5.16,11.34,8.57c5,4.82,10.72,10.28,17.76,13.19,6.8,2.82,14.16,2.93,21.29,3,5.36.08,12.71.19,14.66,2.15s2.07,9.3,2.15,14.66c.11,7.13.22,14.49,3,21.29,2.91,7,8.37,12.73,13.19,17.76,3.41,3.56,8.57,8.94,8.57,11.34S214.84,135.78,211.43,139.34ZM176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M232,128c0,12.51-17.82,21.95-22.68,33.69-4.68,11.32,1.42,30.65-7.78,39.85s-28.53,3.1-39.85,7.78C150,214.18,140.5,232,128,232s-22-17.82-33.69-22.68c-11.32-4.68-30.65,1.42-39.85-7.78s-3.1-28.53-7.78-39.85C41.82,150,24,140.5,24,128s17.82-22,22.68-33.69C51.36,83,45.26,63.66,54.46,54.46S83,51.36,94.31,46.68C106.05,41.82,115.5,24,128,24S150,41.82,161.69,46.68c11.32,4.68,30.65-1.42,39.85,7.78s3.1,28.53,7.78,39.85C214.18,106.05,232,115.5,232,128Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-11.55,39.29c-4.79,5-9.75,10.17-12.38,16.52-2.52,6.1-2.63,13.07-2.73,19.82-.1,7-.21,14.33-3.32,17.43s-10.39,3.22-17.43,3.32c-6.75.1-13.72.21-19.82,2.73-6.35,2.63-11.52,7.59-16.52,12.38S132,224,128,224s-9.15-4.92-14.11-9.69-10.17-9.75-16.52-12.38c-6.1-2.52-13.07-2.63-19.82-2.73-7-.1-14.33-.21-17.43-3.32s-3.22-10.39-3.32-17.43c-.1-6.75-.21-13.72-2.73-19.82-2.63-6.35-7.59-11.52-12.38-16.52S32,132,32,128s4.92-9.15,9.69-14.11,9.75-10.17,12.38-16.52c2.52-6.1,2.63-13.07,2.73-19.82.1-7,.21-14.33,3.32-17.43S70.51,56.9,77.55,56.8c6.75-.1,13.72-.21,19.82-2.73,6.35-2.63,11.52-7.59,16.52-12.38S124,32,128,32s9.15,4.92,14.11,9.69,10.17,9.75,16.52,12.38c6.1,2.52,13.07,2.63,19.82,2.73,7,.1,14.33.21,17.43,3.32s3.22,10.39,3.32,17.43c.1,6.75.21,13.72,2.73,19.82,2.63,6.35,7.59,11.52,12.38,16.52S224,124,224,128,219.08,137.15,214.31,142.11ZM173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-52.2,6.84-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224.42,104.2c-3.9-4.07-7.93-8.27-9.55-12.18-1.5-3.63-1.58-9-1.67-14.68-.14-9.38-.3-20-7.42-27.12S188,42.94,178.66,42.8c-5.68-.09-11-.17-14.68-1.67-3.91-1.62-8.11-5.65-12.18-9.55C145.16,25.22,137.64,18,128,18s-17.16,7.22-23.8,13.58c-4.07,3.9-8.27,7.93-12.18,9.55-3.63,1.5-9,1.58-14.68,1.67-9.38.14-20,.3-27.12,7.42S42.94,68,42.8,77.34c-.09,5.68-.17,11-1.67,14.68-1.62,3.91-5.65,8.11-9.55,12.18C25.22,110.84,18,118.36,18,128s7.22,17.16,13.58,23.8c3.9,4.07,7.93,8.27,9.55,12.18,1.5,3.63,1.58,9,1.67,14.68.14,9.38.3,20,7.42,27.12S68,213.06,77.34,213.2c5.68.09,11,.17,14.68,1.67,3.91,1.62,8.11,5.65,12.18,9.55C110.84,230.78,118.36,238,128,238s17.16-7.22,23.8-13.58c4.07-3.9,8.27-7.93,12.18-9.55,3.63-1.5,9-1.58,14.68-1.67,9.38-.14,20-.3,27.12-7.42s7.28-17.74,7.42-27.12c.09-5.68.17-11,1.67-14.68,1.62-3.91,5.65-8.11,9.55-12.18C230.78,145.16,238,137.64,238,128S230.78,110.84,224.42,104.2Zm-8.66,39.3c-4.67,4.86-9.5,9.9-12,15.9-2.38,5.74-2.48,12.52-2.58,19.08-.11,7.44-.23,15.14-3.9,18.82s-11.38,3.79-18.82,3.9c-6.56.1-13.34.2-19.08,2.58-6,2.48-11,7.31-15.91,12-5.25,5-10.68,10.24-15.49,10.24s-10.24-5.21-15.5-10.24c-4.86-4.67-9.9-9.5-15.9-12-5.74-2.38-12.52-2.48-19.08-2.58-7.44-.11-15.14-.23-18.82-3.9s-3.79-11.38-3.9-18.82c-.1-6.56-.2-13.34-2.58-19.08-2.48-6-7.31-11-12-15.91C35.21,138.24,30,132.81,30,128s5.21-10.24,10.24-15.5c4.67-4.86,9.5-9.9,12-15.9,2.38-5.74,2.48-12.52,2.58-19.08.11-7.44.23-15.14,3.9-18.82s11.38-3.79,18.82-3.9c6.56-.1,13.34-.2,19.08-2.58,6-2.48,11-7.31,15.91-12C117.76,35.21,123.19,30,128,30s10.24,5.21,15.5,10.24c4.86,4.67,9.9,9.5,15.9,12,5.74,2.38,12.52,2.48,19.08,2.58,7.44.11,15.14.23,18.82,3.9s3.79,11.38,3.9,18.82c.1,6.56.2,13.34,2.58,19.08,2.48,6,7.31,11,12,15.91,5,5.25,10.24,10.68,10.24,15.49S220.79,138.24,215.76,143.5ZM172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-11.55,39.29c-4.79,5-9.75,10.17-12.38,16.52-2.52,6.1-2.63,13.07-2.73,19.82-.1,7-.21,14.33-3.32,17.43s-10.39,3.22-17.43,3.32c-6.75.1-13.72.21-19.82,2.73-6.35,2.63-11.52,7.59-16.52,12.38S132,224,128,224s-9.15-4.92-14.11-9.69-10.17-9.75-16.52-12.38c-6.1-2.52-13.07-2.63-19.82-2.73-7-.1-14.33-.21-17.43-3.32s-3.22-10.39-3.32-17.43c-.1-6.75-.21-13.72-2.73-19.82-2.63-6.35-7.59-11.52-12.38-16.52S32,132,32,128s4.92-9.15,9.69-14.11,9.75-10.17,12.38-16.52c2.52-6.1,2.63-13.07,2.73-19.82.1-7,.21-14.33,3.32-17.43S70.51,56.9,77.55,56.8c6.75-.1,13.72-.21,19.82-2.73,6.35-2.63,11.52-7.59,16.52-12.38S124,32,128,32s9.15,4.92,14.11,9.69,10.17,9.75,16.52,12.38c6.1,2.52,13.07,2.63,19.82,2.73,7,.1,14.33.21,17.43,3.32s3.22,10.39,3.32,17.43c.1,6.75.21,13.72,2.73,19.82,2.63,6.35,7.59,11.52,12.38,16.52S224,124,224,128,219.08,137.15,214.31,142.11ZM173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M223,105.58c-4-4.2-8.2-8.54-10-12.8-1.65-4-1.73-9.53-1.82-15.41-.14-9-.29-19.19-6.83-25.74s-16.74-6.69-25.74-6.83c-5.88-.09-11.43-.17-15.41-1.82-4.26-1.76-8.6-5.93-12.8-9.95-6.68-6.41-13.59-13-22.42-13s-15.74,6.62-22.42,13c-4.2,4-8.54,8.2-12.8,10-4,1.65-9.53,1.73-15.41,1.82-9,.14-19.19.29-25.74,6.83S44.94,68.37,44.8,77.37c-.09,5.88-.17,11.43-1.82,15.41-1.76,4.26-5.93,8.6-9.95,12.8-6.41,6.68-13,13.59-13,22.42s6.62,15.74,13,22.42c4,4.2,8.2,8.54,10,12.8,1.65,4,1.73,9.53,1.82,15.41.14,9,.29,19.19,6.83,25.74s16.74,6.69,25.74,6.83c5.88.09,11.43.17,15.41,1.82,4.26,1.76,8.6,5.93,12.8,9.95,6.68,6.41,13.59,13,22.42,13s15.74-6.62,22.42-13c4.2-4,8.54-8.2,12.8-10,4-1.65,9.53-1.73,15.41-1.82,9-.14,19.19-.29,25.74-6.83s6.69-16.74,6.83-25.74c.09-5.88.17-11.43,1.82-15.41,1.76-4.26,5.93-8.6,9.95-12.8,6.41-6.68,13-13.59,13-22.42S229.38,112.26,223,105.58Zm-5.78,39.3c-4.54,4.73-9.24,9.63-11.57,15.28-2.23,5.39-2.33,12-2.43,18.35-.12,8.2-.24,16-4.49,20.2s-12,4.37-20.2,4.49c-6.37.1-13,.2-18.35,2.43-5.65,2.33-10.55,7-15.28,11.57C139.09,222.75,133.62,228,128,228s-11.09-5.25-16.88-10.8c-4.73-4.54-9.63-9.24-15.28-11.57-5.39-2.23-12-2.33-18.35-2.43-8.2-.12-15.95-.24-20.2-4.49s-4.37-12-4.49-20.2c-.1-6.37-.2-13-2.43-18.35-2.33-5.65-7-10.55-11.57-15.28C33.25,139.09,28,133.62,28,128s5.25-11.09,10.8-16.88c4.54-4.73,9.24-9.63,11.57-15.28,2.23-5.39,2.33-12,2.43-18.35.12-8.2.24-15.95,4.49-20.2s12-4.37,20.2-4.49c6.37-.1,13-.2,18.35-2.43,5.65-2.33,10.55-7,15.28-11.57C116.91,33.25,122.38,28,128,28s11.09,5.25,16.88,10.8c4.73,4.54,9.63,9.24,15.28,11.57,5.39,2.23,12,2.33,18.35,2.43,8.2.12,16,.24,20.2,4.49s4.37,12,4.49,20.2c.1,6.37.2,13,2.43,18.35,2.33,5.65,7,10.55,11.57,15.28,5.55,5.79,10.8,11.26,10.8,16.88S222.75,139.09,217.2,144.88Zm-46.37-43.71a4,4,0,0,1,0,5.66l-56,56a4,4,0,0,1-5.66,0l-24-24a4,4,0,0,1,5.66-5.66L112,154.34l53.17-53.17A4,4,0,0,1,170.83,101.17Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/SealCheck.es.js
const o$13 = e$30.forwardRef((a, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...a,
	weights: s$7
}));
o$13.displayName = "SealCheckIcon";
const n$5 = o$13;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/HourglassMedium.es.js
const e$21 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M204,75.64V40a20,20,0,0,0-20-20H72A20,20,0,0,0,52,40V76a20.1,20.1,0,0,0,8,16l48,36L60,164a20.1,20.1,0,0,0-8,16v36a20,20,0,0,0,20,20H184a20,20,0,0,0,20-20V180.36a20.13,20.13,0,0,0-7.94-16L147.9,128l48.16-36.4A20.13,20.13,0,0,0,204,75.64ZM180,44V72H76V44Zm-52,69L105.33,96h45.1Zm52,99H76V182l40-30v16a12,12,0,0,0,24,0V152.11l40,30.24Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M180.92,88,128,128,74.67,88Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.59A16.09,16.09,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.59A16.09,16.09,0,0,0,200,75.64ZM184,180.36V216H72V180l48-36v24a8,8,0,0,0,16,0V144.08Zm0-104.72L178.23,80H77.33L72,76V40H184Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M198,75.64V40a14,14,0,0,0-14-14H72A14,14,0,0,0,58,40V76a14.06,14.06,0,0,0,5.6,11.2L118,128,63.6,168.8A14.06,14.06,0,0,0,58,180v36a14,14,0,0,0,14,14H184a14,14,0,0,0,14-14V180.36a14.08,14.08,0,0,0-5.56-11.17L138,128l54.49-41.19A14.08,14.08,0,0,0,198,75.64ZM70,40a2,2,0,0,1,2-2H184a2,2,0,0,1,2,2V75.64a2,2,0,0,1-.79,1.6L178.9,82H76.67L70.8,77.6A2,2,0,0,1,70,76Zm58,80.49L92.67,94H163Zm58,59.87V216a2,2,0,0,1-2,2H72a2,2,0,0,1-2-2V180a2,2,0,0,1,.8-1.6L122,140v28a6,6,0,0,0,12,0V140.06l51.21,38.7A2,2,0,0,1,186,180.36Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M196,75.64V40a12,12,0,0,0-12-12H72A12,12,0,0,0,60,40V76a12,12,0,0,0,4.8,9.6L121.33,128,64.8,170.4A12,12,0,0,0,60,180v36a12,12,0,0,0,12,12H184a12,12,0,0,0,12-12V180.36a12.05,12.05,0,0,0-4.76-9.57L134.63,128l56.61-42.79A12.05,12.05,0,0,0,196,75.64ZM128,123,86.67,92H169Zm60,57.37V216a4,4,0,0,1-4,4H72a4,4,0,0,1-4-4V180a4,4,0,0,1,1.6-3.2L124,136v32a4,4,0,0,0,8,0V136l54.41,41.13A4,4,0,0,1,188,180.36Zm0-104.72a4,4,0,0,1-1.59,3.19L179.58,84H76l-6.4-4.8A4,4,0,0,1,68,76V40a4,4,0,0,1,4-4H184a4,4,0,0,1,4,4Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/HourglassMedium.es.js
const e$20 = e$30.forwardRef((r, s) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: s,
	...r,
	weights: e$21
}));
e$20.displayName = "HourglassMediumIcon";
const c$5 = e$20;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/NotePencil.es.js
const e$19 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M232.49,55.51l-32-32a12,12,0,0,0-17,0l-96,96A12,12,0,0,0,84,128v32a12,12,0,0,0,12,12h32a12,12,0,0,0,8.49-3.51l96-96A12,12,0,0,0,232.49,55.51ZM192,49l15,15L196,75,181,60Zm-69,99H108V133l56-56,15,15Zm105-7.43V208a20,20,0,0,1-20,20H48a20,20,0,0,1-20-20V48A20,20,0,0,1,48,28h67.43a12,12,0,0,1,0,24H52V204H204V140.57a12,12,0,0,1,24,0Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M200,88l-72,72H96V128l72-72Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Zm5.66-58.34-96,96A8,8,0,0,1,128,168H96a8,8,0,0,1-8-8V128a8,8,0,0,1,2.34-5.66l96-96a8,8,0,0,1,11.32,0l32,32A8,8,0,0,1,229.66,69.66Zm-17-5.66L192,43.31,179.31,56,200,76.69Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228.24,59.76l-32-32a6,6,0,0,0-8.48,0l-96,96A6,6,0,0,0,90,128v32a6,6,0,0,0,6,6h32a6,6,0,0,0,4.24-1.76l96-96A6,6,0,0,0,228.24,59.76ZM125.51,154H102V130.49l66-66L191.51,88ZM200,79.51,176.49,56,192,40.49,215.51,64ZM222,128v80a14,14,0,0,1-14,14H48a14,14,0,0,1-14-14V48A14,14,0,0,1,48,34h80a6,6,0,0,1,0,12H48a2,2,0,0,0-2,2V208a2,2,0,0,0,2,2H208a2,2,0,0,0,2-2V128a6,6,0,0,1,12,0Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M226.83,61.17l-32-32a4,4,0,0,0-5.66,0l-96,96A4,4,0,0,0,92,128v32a4,4,0,0,0,4,4h32a4,4,0,0,0,2.83-1.17l96-96A4,4,0,0,0,226.83,61.17ZM126.34,156H100V129.66l68-68L194.34,88ZM200,82.34,173.66,56,192,37.66,218.34,64ZM220,128v80a12,12,0,0,1-12,12H48a12,12,0,0,1-12-12V48A12,12,0,0,1,48,36h80a4,4,0,0,1,0,8H48a4,4,0,0,0-4,4V208a4,4,0,0,0,4,4H208a4,4,0,0,0,4-4V128a4,4,0,0,1,8,0Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/NotePencil.es.js
const o$12 = e$30.forwardRef((t, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...t,
	weights: e$19
}));
o$12.displayName = "NotePencilIcon";
const m$3 = o$12;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ShieldCheck.es.js
const e$18 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,36H48A20,20,0,0,0,28,56v56c0,54.29,26.32,87.22,48.4,105.29,23.71,19.39,47.44,26,48.44,26.29a12.1,12.1,0,0,0,6.32,0c1-.28,24.73-6.9,48.44-26.29,22.08-18.07,48.4-51,48.4-105.29V56A20,20,0,0,0,208,36Zm-4,76c0,35.71-13.09,64.69-38.91,86.15A126.28,126.28,0,0,1,128,219.38a126.14,126.14,0,0,1-37.09-21.23C65.09,176.69,52,147.71,52,112V60H204ZM79.51,144.49a12,12,0,1,1,17-17L112,143l47.51-47.52a12,12,0,0,1,17,17l-56,56a12,12,0,0,1-17,0Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,56v56c0,96-88,120-88,120S40,208,40,112V56a8,8,0,0,1,8-8H208A8,8,0,0,1,216,56Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-34.32,69.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,42H48A14,14,0,0,0,34,56v56c0,51.94,25.12,83.4,46.2,100.64,22.73,18.6,45.27,24.89,46.22,25.15a6,6,0,0,0,3.16,0c.95-.26,23.49-6.55,46.22-25.15C196.88,195.4,222,163.94,222,112V56A14,14,0,0,0,208,42Zm2,70c0,37.76-13.94,68.39-41.44,91.06A131.17,131.17,0,0,1,128,225.72a130.94,130.94,0,0,1-40.56-22.66C59.94,180.39,46,149.76,46,112V56a2,2,0,0,1,2-2H208a2,2,0,0,1,2,2ZM172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,44H48A12,12,0,0,0,36,56v56c0,51.16,24.73,82.12,45.47,99.1,22.4,18.32,44.55,24.5,45.48,24.76a4,4,0,0,0,2.1,0c.93-.26,23.08-6.44,45.48-24.76,20.74-17,45.47-47.94,45.47-99.1V56A12,12,0,0,0,208,44Zm4,68c0,38.44-14.23,69.63-42.29,92.71A132.45,132.45,0,0,1,128,227.82a132.23,132.23,0,0,1-41.71-23.11C58.23,181.63,44,150.44,44,112V56a4,4,0,0,1,4-4H208a4,4,0,0,1,4,4Zm-41.17-10.83a4,4,0,0,1,0,5.66l-56,56a4,4,0,0,1-5.66,0l-24-24a4,4,0,0,1,5.66-5.66L112,154.34l53.17-53.17A4,4,0,0,1,170.83,101.17Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ShieldCheck.es.js
const o$11 = e$30.forwardRef((c, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...c,
	weights: e$18
}));
o$11.displayName = "ShieldCheckIcon";
const h = o$11;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/GraduationCap.es.js
const l$5 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M249.8,85.49l-116-64a12,12,0,0,0-11.6,0l-116,64a12,12,0,0,0,0,21l21.8,12v47.76a19.89,19.89,0,0,0,5.09,13.32C46.63,194.7,77,220,128,220a136.88,136.88,0,0,0,40-5.75V240a12,12,0,0,0,24,0V204.12a119.53,119.53,0,0,0,30.91-24.51A19.89,19.89,0,0,0,228,166.29V118.53l21.8-12a12,12,0,0,0,0-21ZM128,45.71,219.16,96,186,114.3a1.88,1.88,0,0,1-.18-.12l-52-28.69a12,12,0,0,0-11.6,21l39,21.49L128,146.3,36.84,96ZM128,196c-40.42,0-64.65-19.07-76-31.27v-33l70.2,38.74a12,12,0,0,0,11.6,0L168,151.64v37.23A110.46,110.46,0,0,1,128,196Zm76-31.27a93.21,93.21,0,0,1-12,10.81V138.39l12-6.62Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,113.07v53.22a8,8,0,0,1-2,5.31c-11.3,12.59-38.9,36.4-86,36.4s-74.68-23.81-86-36.4a8,8,0,0,1-2-5.31V113.07L128,160Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M176,207.24a119,119,0,0,0,16-7.73V240a8,8,0,0,1-16,0Zm11.76-88.43-56-29.87a8,8,0,0,0-7.52,14.12L171,128l17-9.06Zm64-29.87-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V130.67L171,128l-43,22.93L43.83,106l0,0L25,96,128,41.07,231,96l-18.78,10-.06,0L188,118.94a8,8,0,0,1,4,6.93v73.64a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M250.82,90.71l-120-64a5.94,5.94,0,0,0-5.64,0l-120,64a6,6,0,0,0,0,10.58L34,116.67v49.62a14,14,0,0,0,3.55,9.32C50.42,189.94,79.29,214,128,214a127.21,127.21,0,0,0,50-9.73V240a6,6,0,0,0,12,0V198.35a113.18,113.18,0,0,0,28.45-22.75,13.91,13.91,0,0,0,3.55-9.31V116.67l28.82-15.38a6,6,0,0,0,0-10.58ZM128,202c-44,0-70-21.56-81.52-34.41a2,2,0,0,1-.48-1.3V123.07l79.18,42.22a6,6,0,0,0,5.64,0L178,140.13v51C165,197.35,148.45,202,128,202Zm82-35.71a2,2,0,0,1-.48,1.3A100.25,100.25,0,0,1,190,184.3V133.73l20-10.66Zm-22.15-45a6.27,6.27,0,0,0-1-.71l-56-29.86a6,6,0,0,0-5.64,10.58L175.25,128,128,153.2,20.75,96,128,38.8,235.25,96Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M249.88,92.47l-120-64a4,4,0,0,0-3.76,0l-120,64a4,4,0,0,0,0,7.06L36,115.47v50.82a11.92,11.92,0,0,0,3,8c12.65,14.09,41,37.73,89,37.73,21,0,38.2-4.52,52-10.79V240a4,4,0,0,0,8,0V197.18a111.64,111.64,0,0,0,29-22.91,11.94,11.94,0,0,0,3-8V115.47l29.88-15.94a4,4,0,0,0,0-7.06ZM128,204c-44.83,0-71.25-22-83-35.08a3.92,3.92,0,0,1-1-2.63V119.73l82.12,43.8a4,4,0,0,0,3.76,0L180,136.8v55.53C166.58,199,149.39,204,128,204Zm84-37.71a4,4,0,0,1-1,2.64,103.32,103.32,0,0,1-23,19v-55.4l24-12.8Zm-24.59-42.51a4,4,0,0,0-1.53-1.44l-56-29.87a4,4,0,0,0-3.76,7.06L179.5,128,128,155.47,16.5,96,128,36.53,239.5,96Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/GraduationCap.es.js
const o$10 = e$30.forwardRef((r, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...r,
	weights: l$5
}));
o$10.displayName = "GraduationCapIcon";
const p$1 = o$10;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/PaperPlaneTilt.es.js
const e$17 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M230.14,25.86a20,20,0,0,0-19.57-5.11l-.22.07L18.44,79a20,20,0,0,0-3.06,37.25L99,157l40.71,83.65a19.81,19.81,0,0,0,18,11.38c.57,0,1.15,0,1.73-.07A19.82,19.82,0,0,0,177,237.56L235.18,45.65a1.42,1.42,0,0,0,.07-.22A20,20,0,0,0,230.14,25.86ZM156.91,221.07l-34.37-70.64,46-45.95a12,12,0,0,0-17-17l-46,46L34.93,99.09,210,46Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M223.69,42.18l-58.22,192a8,8,0,0,1-14.92,1.25L108,148,20.58,105.45a8,8,0,0,1,1.25-14.92l192-58.22A8,8,0,0,1,223.69,42.18Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M225.88,30.12a13.83,13.83,0,0,0-13.7-3.58l-.11,0L20.14,84.77A14,14,0,0,0,18,110.85l85.56,41.64L145.12,238a13.87,13.87,0,0,0,12.61,8c.4,0,.81,0,1.21-.05a13.9,13.9,0,0,0,12.29-10.09l58.2-191.93,0-.11A13.83,13.83,0,0,0,225.88,30.12Zm-8,10.4L159.73,232.43l0,.11a2,2,0,0,1-3.76.26l-40.68-83.58,49-49a6,6,0,1,0-8.49-8.49l-49,49L23.15,100a2,2,0,0,1,.31-3.74l.11,0L215.48,38.08a1.94,1.94,0,0,1,1.92.52A2,2,0,0,1,217.92,40.52Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224.47,31.52a11.87,11.87,0,0,0-11.82-3L20.74,86.67a12,12,0,0,0-1.91,22.38L105,151l41.92,86.15A11.88,11.88,0,0,0,157.74,244c.34,0,.69,0,1,0a11.89,11.89,0,0,0,10.52-8.63l58.21-192,0-.08A11.85,11.85,0,0,0,224.47,31.52Zm-4.62,9.54-58.23,192a4,4,0,0,1-7.48.59l-41.3-84.86,50-50a4,4,0,1,0-5.66-5.66l-50,50-84.9-41.31a3.88,3.88,0,0,1-2.27-4,3.93,3.93,0,0,1,3-3.54L214.9,36.16A3.93,3.93,0,0,1,216,36a4,4,0,0,1,2.79,1.19A3.93,3.93,0,0,1,219.85,41.06Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/PaperPlaneTilt.es.js
const a$6 = e$30.forwardRef((o, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...o,
	weights: e$17
}));
a$6.displayName = "PaperPlaneTiltIcon";
const m$2 = a$6;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/UploadSimple.es.js
const e$16 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0ZM96.49,80.49,116,61v83a12,12,0,0,0,24,0V61l19.51,19.52a12,12,0,1,0,17-17l-40-40a12,12,0,0,0-17,0l-40,40a12,12,0,1,0,17,17Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,48V208H40V48A16,16,0,0,1,56,32H200A16,16,0,0,1,216,48Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM88,80h32v64a8,8,0,0,0,16,0V80h32a8,8,0,0,0,5.66-13.66l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,88,80Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M222,144v64a6,6,0,0,1-6,6H40a6,6,0,0,1-6-6V144a6,6,0,0,1,12,0v58H210V144a6,6,0,0,1,12,0ZM92.24,76.24,122,46.49V144a6,6,0,0,0,12,0V46.49l29.76,29.75a6,6,0,0,0,8.48-8.48l-40-40a6,6,0,0,0-8.48,0l-40,40a6,6,0,0,0,8.48,8.48Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M220,144v64a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V144a4,4,0,0,1,8,0v60H212V144a4,4,0,0,1,8,0ZM90.83,74.83,124,41.66V144a4,4,0,0,0,8,0V41.66l33.17,33.17a4,4,0,1,0,5.66-5.66l-40-40a4,4,0,0,0-5.66,0l-40,40a4,4,0,0,0,5.66,5.66Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/UploadSimple.es.js
const e$15 = e$30.forwardRef((a, m) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: m,
	...a,
	weights: e$16
}));
e$15.displayName = "UploadSimpleIcon";
const l$4 = e$15;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/SquaresFour.es.js
const e$14 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M100,36H56A20,20,0,0,0,36,56v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V56A20,20,0,0,0,100,36ZM96,96H60V60H96ZM200,36H156a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V56A20,20,0,0,0,200,36Zm-4,60H160V60h36Zm-96,40H56a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V156A20,20,0,0,0,100,136Zm-4,60H60V160H96Zm104-60H156a20,20,0,0,0-20,20v44a20,20,0,0,0,20,20h44a20,20,0,0,0,20-20V156A20,20,0,0,0,200,136Zm-4,60H160V160h36Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M112,56v48a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h48A8,8,0,0,1,112,56Zm88-8H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V56A8,8,0,0,0,200,48Zm-96,96H56a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,104,144Zm96,0H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,200,144Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M200,136H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48ZM104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M120,56v48a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40h48A16,16,0,0,1,120,56Zm80-16H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm-96,96H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm96,0H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M104,42H56A14,14,0,0,0,42,56v48a14,14,0,0,0,14,14h48a14,14,0,0,0,14-14V56A14,14,0,0,0,104,42Zm2,62a2,2,0,0,1-2,2H56a2,2,0,0,1-2-2V56a2,2,0,0,1,2-2h48a2,2,0,0,1,2,2Zm94-62H152a14,14,0,0,0-14,14v48a14,14,0,0,0,14,14h48a14,14,0,0,0,14-14V56A14,14,0,0,0,200,42Zm2,62a2,2,0,0,1-2,2H152a2,2,0,0,1-2-2V56a2,2,0,0,1,2-2h48a2,2,0,0,1,2,2Zm-98,34H56a14,14,0,0,0-14,14v48a14,14,0,0,0,14,14h48a14,14,0,0,0,14-14V152A14,14,0,0,0,104,138Zm2,62a2,2,0,0,1-2,2H56a2,2,0,0,1-2-2V152a2,2,0,0,1,2-2h48a2,2,0,0,1,2,2Zm94-62H152a14,14,0,0,0-14,14v48a14,14,0,0,0,14,14h48a14,14,0,0,0,14-14V152A14,14,0,0,0,200,138Zm2,62a2,2,0,0,1-2,2H152a2,2,0,0,1-2-2V152a2,2,0,0,1,2-2h48a2,2,0,0,1,2,2Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M104,44H56A12,12,0,0,0,44,56v48a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V56A12,12,0,0,0,104,44Zm4,60a4,4,0,0,1-4,4H56a4,4,0,0,1-4-4V56a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4Zm92-60H152a12,12,0,0,0-12,12v48a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V56A12,12,0,0,0,200,44Zm4,60a4,4,0,0,1-4,4H152a4,4,0,0,1-4-4V56a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4ZM104,140H56a12,12,0,0,0-12,12v48a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V152A12,12,0,0,0,104,140Zm4,60a4,4,0,0,1-4,4H56a4,4,0,0,1-4-4V152a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4Zm92-60H152a12,12,0,0,0-12,12v48a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V152A12,12,0,0,0,200,140Zm4,60a4,4,0,0,1-4,4H152a4,4,0,0,1-4-4V152a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/SquaresFour.es.js
const r$3 = e$30.forwardRef((e, a) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: a,
	...e,
	weights: e$14
}));
r$3.displayName = "SquaresFourIcon";
const n$4 = r$3;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/SignOut.es.js
const e$13 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M124,216a12,12,0,0,1-12,12H48a12,12,0,0,1-12-12V40A12,12,0,0,1,48,28h64a12,12,0,0,1,0,24H60V204h52A12,12,0,0,1,124,216Zm108.49-96.49-40-40a12,12,0,0,0-17,17L195,116H112a12,12,0,0,0,0,24h83l-19.52,19.51a12,12,0,0,0,17,17l40-40A12,12,0,0,0,232.49,119.51Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M224,56V200a16,16,0,0,1-16,16H48V40H208A16,16,0,0,1,224,56Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40A8,8,0,0,0,176,88v32H112a8,8,0,0,0,0,16h64v32a8,8,0,0,0,13.66,5.66l40-40A8,8,0,0,0,229.66,122.34Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M118,216a6,6,0,0,1-6,6H48a6,6,0,0,1-6-6V40a6,6,0,0,1,6-6h64a6,6,0,0,1,0,12H54V210h58A6,6,0,0,1,118,216Zm110.24-92.24-40-40a6,6,0,0,0-8.48,8.48L209.51,122H112a6,6,0,0,0,0,12h97.51l-29.75,29.76a6,6,0,1,0,8.48,8.48l40-40A6,6,0,0,0,228.24,123.76Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M116,216a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V40a4,4,0,0,1,4-4h64a4,4,0,0,1,0,8H52V212h60A4,4,0,0,1,116,216Zm110.83-90.83-40-40a4,4,0,0,0-5.66,5.66L214.34,124H112a4,4,0,0,0,0,8H214.34l-33.17,33.17a4,4,0,0,0,5.66,5.66l40-40A4,4,0,0,0,226.83,125.17Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/SignOut.es.js
const t$1 = e$30.forwardRef((e, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...e,
	weights: e$13
}));
t$1.displayName = "SignOutIcon";
const c$4 = t$1;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/PencilRuler.es.js
const V = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,28H160a20,20,0,0,0-20,20V208a20,20,0,0,0,20,20h48a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28Zm-4,176H164V180h16a12,12,0,0,0,0-24H164V140h16a12,12,0,0,0,0-24H164V100h16a12,12,0,0,0,0-24H164V52h40ZM80.49,23.51a12,12,0,0,0-17,0l-32,32A12,12,0,0,0,28,64V208a20,20,0,0,0,20,20H96a20,20,0,0,0,20-20V64a12,12,0,0,0-3.51-8.49ZM52,92H92v72H52ZM72,49,91,68H53ZM52,204V188H92v16Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M40,184h64v24a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8ZM208,40H160a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V48A8,8,0,0,0,208,40Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H160V176h24a8,8,0,0,0,0-16H160V136h24a8,8,0,0,0,0-16H160V96h24a8,8,0,0,0,0-16H160V48h48V208ZM77.66,26.34a8,8,0,0,0-11.32,0l-32,32A8,8,0,0,0,32,64V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V64a8,8,0,0,0-2.34-5.66ZM48,176V80H64v96ZM80,80H96v96H80ZM72,43.31,92.69,64H51.31ZM48,208V192H96v16Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V180a4,4,0,0,1,4-4h36a8,8,0,0,0,8-8.53,8.18,8.18,0,0,0-8.25-7.47H148a4,4,0,0,1-4-4V140a4,4,0,0,1,4-4h36a8,8,0,0,0,8-8.53,8.18,8.18,0,0,0-8.25-7.47H148a4,4,0,0,1-4-4V100a4,4,0,0,1,4-4h36a8,8,0,0,0,8-8.53A8.18,8.18,0,0,0,183.73,80H148a4,4,0,0,1-4-4V48a16,16,0,0,1,16-16h48A16,16,0,0,1,224,48ZM109.66,58.34A8,8,0,0,1,112,64V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V64a8,8,0,0,1,2.34-5.66l32-32a8,8,0,0,1,11.32,0ZM48,80V184H64V80Zm32,0V184H96V80ZM51.31,64H92.69L72,43.31Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,34H160a14,14,0,0,0-14,14V208a14,14,0,0,0,14,14h48a14,14,0,0,0,14-14V48A14,14,0,0,0,208,34Zm2,174a2,2,0,0,1-2,2H160a2,2,0,0,1-2-2V174h26a6,6,0,0,0,0-12H158V134h26a6,6,0,0,0,0-12H158V94h26a6,6,0,0,0,0-12H158V48a2,2,0,0,1,2-2h48a2,2,0,0,1,2,2ZM76.24,27.76a6,6,0,0,0-8.48,0l-32,32A6,6,0,0,0,34,64V208a14,14,0,0,0,14,14H96a14,14,0,0,0,14-14V64a6,6,0,0,0-1.76-4.24ZM46,178V78H66V178ZM78,78H98V178H78ZM72,40.49,97.51,66h-51ZM96,210H48a2,2,0,0,1-2-2V190H98v18A2,2,0,0,1,96,210Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H160V176h24a8,8,0,0,0,0-16H160V136h24a8,8,0,0,0,0-16H160V96h24a8,8,0,0,0,0-16H160V48h48V208ZM77.66,26.34a8,8,0,0,0-11.32,0l-32,32A8,8,0,0,0,32,64V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V64a8,8,0,0,0-2.34-5.66ZM48,176V80H64v96ZM80,80H96v96H80ZM72,43.31,92.69,64H51.31ZM48,208V192H96v16Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,36H160a12,12,0,0,0-12,12V208a12,12,0,0,0,12,12h48a12,12,0,0,0,12-12V48A12,12,0,0,0,208,36Zm4,172a4,4,0,0,1-4,4H160a4,4,0,0,1-4-4V172h28a4,4,0,0,0,0-8H156V132h28a4,4,0,0,0,0-8H156V92h28a4,4,0,0,0,0-8H156V48a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4ZM74.83,29.17a4,4,0,0,0-5.66,0l-32,32A4,4,0,0,0,36,64V208a12,12,0,0,0,12,12H96a12,12,0,0,0,12-12V64a4,4,0,0,0-1.17-2.83ZM44,76H68V180H44Zm56,132a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V188h56Zm0-28H76V76h24Zm0-112H44V65.66l28-28,28,28Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/PencilRuler.es.js
const o$9 = e$30.forwardRef((r, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...r,
	weights: V
}));
o$9.displayName = "PencilRulerIcon";
const l$3 = o$9;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Sparkle.es.js
const l$2 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M199,125.31l-49.88-18.39L130.69,57a19.92,19.92,0,0,0-37.38,0L74.92,106.92,25,125.31a19.92,19.92,0,0,0,0,37.38l49.88,18.39L93.31,231a19.92,19.92,0,0,0,37.38,0l18.39-49.88L199,162.69a19.92,19.92,0,0,0,0-37.38Zm-63.38,35.16a12,12,0,0,0-7.11,7.11L112,212.28l-16.47-44.7a12,12,0,0,0-7.11-7.11L43.72,144l44.7-16.47a12,12,0,0,0,7.11-7.11L112,75.72l16.47,44.7a12,12,0,0,0,7.11,7.11L180.28,144ZM140,40a12,12,0,0,1,12-12h12V16a12,12,0,0,1,24,0V28h12a12,12,0,0,1,0,24H188V64a12,12,0,0,1-24,0V52H152A12,12,0,0,1,140,40ZM252,88a12,12,0,0,1-12,12h-4v4a12,12,0,0,1-24,0v-4h-4a12,12,0,0,1,0-24h4V72a12,12,0,0,1,24,0v4h4A12,12,0,0,1,252,88Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M194.82,151.43l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0l-20.3-55.09-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3A7.92,7.92,0,0,1,194.82,151.43Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M196.89,130.94,144.4,111.6,125.06,59.11a13.92,13.92,0,0,0-26.12,0L79.6,111.6,27.11,130.94a13.92,13.92,0,0,0,0,26.12L79.6,176.4l19.34,52.49a13.92,13.92,0,0,0,26.12,0L144.4,176.4l52.49-19.34a13.92,13.92,0,0,0,0-26.12Zm-4.15,14.86-55.08,20.3a6,6,0,0,0-3.56,3.56l-20.3,55.08a1.92,1.92,0,0,1-3.6,0L89.9,169.66a6,6,0,0,0-3.56-3.56L31.26,145.8a1.92,1.92,0,0,1,0-3.6l55.08-20.3a6,6,0,0,0,3.56-3.56l20.3-55.08a1.92,1.92,0,0,1,3.6,0l20.3,55.08a6,6,0,0,0,3.56,3.56l55.08,20.3a1.92,1.92,0,0,1,0,3.6ZM146,40a6,6,0,0,1,6-6h18V16a6,6,0,0,1,12,0V34h18a6,6,0,0,1,0,12H182V64a6,6,0,0,1-12,0V46H152A6,6,0,0,1,146,40ZM246,88a6,6,0,0,1-6,6H230v10a6,6,0,0,1-12,0V94H208a6,6,0,0,1,0-12h10V72a6,6,0,0,1,12,0V82h10A6,6,0,0,1,246,88Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M196.2,132.81l-53.36-19.65L123.19,59.8a11.93,11.93,0,0,0-22.38,0L81.16,113.16,27.8,132.81a11.93,11.93,0,0,0,0,22.38l53.36,19.65,19.65,53.36a11.93,11.93,0,0,0,22.38,0l19.65-53.36,53.36-19.65a11.93,11.93,0,0,0,0-22.38Zm-2.77,14.87L138.35,168a4,4,0,0,0-2.37,2.37l-20.3,55.08a3.92,3.92,0,0,1-7.36,0L88,170.35A4,4,0,0,0,85.65,168l-55.08-20.3a3.92,3.92,0,0,1,0-7.36L85.65,120A4,4,0,0,0,88,117.65l20.3-55.08a3.92,3.92,0,0,1,7.36,0L136,117.65a4,4,0,0,0,2.37,2.37l55.08,20.3a3.92,3.92,0,0,1,0,7.36ZM148,40a4,4,0,0,1,4-4h20V16a4,4,0,0,1,8,0V36h20a4,4,0,0,1,0,8H180V64a4,4,0,0,1-8,0V44H152A4,4,0,0,1,148,40Zm96,48a4,4,0,0,1-4,4H228v12a4,4,0,0,1-8,0V92H208a4,4,0,0,1,0-8h12V72a4,4,0,0,1,8,0V84h12A4,4,0,0,1,244,88Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Sparkle.es.js
const o$8 = e$30.forwardRef((r, a) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: a,
	...r,
	weights: l$2
}));
o$8.displayName = "SparkleIcon";
const s$6 = o$8;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/GridFour.es.js
const a$5 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,36H56A20,20,0,0,0,36,56V200a20,20,0,0,0,20,20H200a20,20,0,0,0,20-20V56A20,20,0,0,0,200,36Zm-4,80H140V60h56ZM116,60v56H60V60ZM60,140h56v56H60Zm80,56V140h56v56Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M208,56V200a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H200A8,8,0,0,1,208,56Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,80H136V56h64ZM120,56v64H56V56ZM56,136h64v64H56Zm144,64H136V136h64v64Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M216,56v60a4,4,0,0,1-4,4H136V44a4,4,0,0,1,4-4h60A16,16,0,0,1,216,56ZM116,40H56A16,16,0,0,0,40,56v60a4,4,0,0,0,4,4h76V44A4,4,0,0,0,116,40Zm96,96H136v76a4,4,0,0,0,4,4h60a16,16,0,0,0,16-16V140A4,4,0,0,0,212,136ZM40,140v60a16,16,0,0,0,16,16h60a4,4,0,0,0,4-4V136H44A4,4,0,0,0,40,140Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,42H56A14,14,0,0,0,42,56V200a14,14,0,0,0,14,14H200a14,14,0,0,0,14-14V56A14,14,0,0,0,200,42Zm2,14v66H134V54h66A2,2,0,0,1,202,56ZM56,54h66v68H54V56A2,2,0,0,1,56,54ZM54,200V134h68v68H56A2,2,0,0,1,54,200Zm146,2H134V134h68v66A2,2,0,0,1,200,202Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,80H136V56h64ZM120,56v64H56V56ZM56,136h64v64H56Zm144,64H136V136h64v64Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M200,44H56A12,12,0,0,0,44,56V200a12,12,0,0,0,12,12H200a12,12,0,0,0,12-12V56A12,12,0,0,0,200,44Zm4,12v68H132V52h68A4,4,0,0,1,204,56ZM56,52h68v72H52V56A4,4,0,0,1,56,52ZM52,200V132h72v72H56A4,4,0,0,1,52,200Zm148,4H132V132h72v68A4,4,0,0,1,200,204Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/GridFour.es.js
const r$2 = e$30.forwardRef((e, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...e,
	weights: a$5
}));
r$2.displayName = "GridFourIcon";
const s$5 = r$2;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Archive.es.js
const e$12 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,44H32A20,20,0,0,0,12,64V88a20,20,0,0,0,16,19.6V192a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V107.6A20,20,0,0,0,244,88V64A20,20,0,0,0,224,44ZM36,68H220V84H36ZM52,188V108H204v80Zm112-52a12,12,0,0,1-12,12H104a12,12,0,0,1,0-24h48A12,12,0,0,1,164,136Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,96v96a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm-72,96H104a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm72-56H32V64H224V88Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,50H32A14,14,0,0,0,18,64V88a14,14,0,0,0,14,14h2v90a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V102h2a14,14,0,0,0,14-14V64A14,14,0,0,0,224,50ZM210,192a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V102H210ZM226,88a2,2,0,0,1-2,2H32a2,2,0,0,1-2-2V64a2,2,0,0,1,2-2H224a2,2,0,0,1,2,2ZM98,136a6,6,0,0,1,6-6h48a6,6,0,0,1,0,12H104A6,6,0,0,1,98,136Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,52H32A12,12,0,0,0,20,64V88a12,12,0,0,0,12,12h4v92a12,12,0,0,0,12,12H208a12,12,0,0,0,12-12V100h4a12,12,0,0,0,12-12V64A12,12,0,0,0,224,52ZM212,192a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V100H212ZM228,88a4,4,0,0,1-4,4H32a4,4,0,0,1-4-4V64a4,4,0,0,1,4-4H224a4,4,0,0,1,4,4ZM100,136a4,4,0,0,1,4-4h48a4,4,0,0,1,0,8H104A4,4,0,0,1,100,136Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Archive.es.js
const o$7 = e$30.forwardRef((r, c) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: c,
	...r,
	weights: e$12
}));
o$7.displayName = "ArchiveIcon";
const s$4 = o$7;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/ChartBar.es.js
const e$11 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,196h-4V40a12,12,0,0,0-12-12H152a12,12,0,0,0-12,12V76H96A12,12,0,0,0,84,88v36H48a12,12,0,0,0-12,12v60H32a12,12,0,0,0,0,24H224a12,12,0,0,0,0-24ZM164,52h32V196H164Zm-56,48h32v96H108ZM60,148H84v48H60Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M208,40V208H152V40Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,202H214V40a6,6,0,0,0-6-6H152a6,6,0,0,0-6,6V82H96a6,6,0,0,0-6,6v42H48a6,6,0,0,0-6,6v66H32a6,6,0,0,0,0,12H224a6,6,0,0,0,0-12ZM158,46h44V202H158ZM102,94h44V202H102ZM54,142H90v60H54Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,204H212V40a4,4,0,0,0-4-4H152a4,4,0,0,0-4,4V84H96a4,4,0,0,0-4,4v44H48a4,4,0,0,0-4,4v68H32a4,4,0,0,0,0,8H224a4,4,0,0,0,0-8ZM156,44h48V204H156ZM100,92h48V204H100ZM52,140H92v64H52Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/ChartBar.es.js
const a$4 = e$30.forwardRef((o, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...o,
	weights: e$11
}));
a$4.displayName = "ChartBarIcon";
const n$3 = a$4;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/DownloadSimple.es.js
const e$10 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0Zm-108.49,8.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0-17-17L140,115V32a12,12,0,0,0-24,0v83L96.49,95.51a12,12,0,0,0-17,17Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,48V208H40V48A16,16,0,0,1,56,32H200A16,16,0,0,1,216,48Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,168,96H136V32a8,8,0,0,0-16,0V96H88a8,8,0,0,0-5.66,13.66Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M222,144v64a6,6,0,0,1-6,6H40a6,6,0,0,1-6-6V144a6,6,0,0,1,12,0v58H210V144a6,6,0,0,1,12,0Zm-98.24,4.24a6,6,0,0,0,8.48,0l40-40a6,6,0,0,0-8.48-8.48L134,129.51V32a6,6,0,0,0-12,0v97.51L92.24,99.76a6,6,0,0,0-8.48,8.48Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M220,144v64a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V144a4,4,0,0,1,8,0v60H212V144a4,4,0,0,1,8,0Zm-94.83,2.83a4,4,0,0,0,5.66,0l40-40a4,4,0,1,0-5.66-5.66L132,134.34V32a4,4,0,0,0-8,0V134.34L90.83,101.17a4,4,0,0,0-5.66,5.66Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/DownloadSimple.es.js
const e$9 = e$30.forwardRef((a, m) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: m,
	...a,
	weights: e$10
}));
e$9.displayName = "DownloadSimpleIcon";
const l$1 = e$9;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/UsersThree.es.js
const e$8 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M164.38,181.1a52,52,0,1,0-72.76,0,75.89,75.89,0,0,0-30,28.89,12,12,0,0,0,20.78,12,53,53,0,0,1,91.22,0,12,12,0,1,0,20.78-12A75.89,75.89,0,0,0,164.38,181.1ZM100,144a28,28,0,1,1,28,28A28,28,0,0,1,100,144Zm147.21,9.59a12,12,0,0,1-16.81-2.39c-8.33-11.09-19.85-19.59-29.33-21.64a12,12,0,0,1-1.82-22.91,20,20,0,1,0-24.78-28.3,12,12,0,1,1-21-11.6,44,44,0,1,1,73.28,48.35,92.18,92.18,0,0,1,22.85,21.69A12,12,0,0,1,247.21,153.59Zm-192.28-24c-9.48,2.05-21,10.55-29.33,21.65A12,12,0,0,1,6.41,136.79,92.37,92.37,0,0,1,29.26,115.1a44,44,0,1,1,73.28-48.35,12,12,0,1,1-21,11.6,20,20,0,1,0-24.78,28.3,12,12,0,0,1-1.82,22.91Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M168,144a40,40,0,1,1-40-40A40,40,0,0,1,168,144ZM64,56A32,32,0,1,0,96,88,32,32,0,0,0,64,56Zm128,0a32,32,0,1,0,32,32A32,32,0,0,0,192,56Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1,0-16,24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.85,8,57,57,0,0,0-98.15,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M243.6,148.8a6,6,0,0,1-8.4-1.2A53.58,53.58,0,0,0,192,126a6,6,0,0,1,0-12,26,26,0,1,0-25.18-32.5,6,6,0,0,1-11.62-3,38,38,0,1,1,59.91,39.63A65.69,65.69,0,0,1,244.8,140.4,6,6,0,0,1,243.6,148.8ZM189.19,213a6,6,0,0,1-2.19,8.2,5.9,5.9,0,0,1-3,.81,6,6,0,0,1-5.2-3,59,59,0,0,0-101.62,0,6,6,0,1,1-10.38-6A70.1,70.1,0,0,1,103,182.55a46,46,0,1,1,50.1,0A70.1,70.1,0,0,1,189.19,213ZM128,178a34,34,0,1,0-34-34A34,34,0,0,0,128,178ZM70,120a6,6,0,0,0-6-6A26,26,0,1,1,89.18,81.49a6,6,0,1,0,11.62-3,38,38,0,1,0-59.91,39.63A65.69,65.69,0,0,0,11.2,140.4a6,6,0,1,0,9.6,7.2A53.58,53.58,0,0,1,64,126,6,6,0,0,0,70,120Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M237,147.44a4,4,0,0,1-5.48-1.4c-8.33-14-20.93-22-34.56-22a4,4,0,0,1-1.2-.2,36.76,36.76,0,0,1-3.8.2,4,4,0,0,1,0-8,28,28,0,1,0-27.12-35,4,4,0,0,1-7.75-2,36,36,0,1,1,54,39.48c10.81,3.85,20.51,12,27.31,23.48A4,4,0,0,1,237,147.44ZM187.46,214a4,4,0,0,1-1.46,5.46,3.93,3.93,0,0,1-2,.54,4,4,0,0,1-3.46-2,61,61,0,0,0-105.08,0,4,4,0,0,1-6.92-4,68.35,68.35,0,0,1,39.19-31,44,44,0,1,1,40.54,0A68.35,68.35,0,0,1,187.46,214ZM128,180a36,36,0,1,0-36-36A36,36,0,0,0,128,180ZM64,116A28,28,0,1,1,91.12,81a4,4,0,0,0,7.75-2A36,36,0,1,0,45.3,118.75,63.55,63.55,0,0,0,12.8,141.6a4,4,0,0,0,6.4,4.8A55.55,55.55,0,0,1,64,124a4,4,0,0,0,0-8Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/UsersThree.es.js
const r$1 = e$30.forwardRef((o, s) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: s,
	...o,
	weights: e$8
}));
r$1.displayName = "UsersThreeIcon";
const n$2 = r$1;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/GearSix.es.js
const l = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,76a52,52,0,1,0,52,52A52.06,52.06,0,0,0,128,76Zm0,80a28,28,0,1,1,28-28A28,28,0,0,1,128,156Zm113.86-49.57A12,12,0,0,0,236,98.34L208.21,82.49l-.11-31.31a12,12,0,0,0-4.25-9.12,116,116,0,0,0-38-21.41,12,12,0,0,0-9.68.89L128,37.27,99.83,21.53a12,12,0,0,0-9.7-.9,116.06,116.06,0,0,0-38,21.47,12,12,0,0,0-4.24,9.1l-.14,31.34L20,98.35a12,12,0,0,0-5.85,8.11,110.7,110.7,0,0,0,0,43.11A12,12,0,0,0,20,157.66l27.82,15.85.11,31.31a12,12,0,0,0,4.25,9.12,116,116,0,0,0,38,21.41,12,12,0,0,0,9.68-.89L128,218.73l28.14,15.74a12,12,0,0,0,9.7.9,116.06,116.06,0,0,0,38-21.47,12,12,0,0,0,4.24-9.1l.14-31.34,27.81-15.81a12,12,0,0,0,5.85-8.11A110.7,110.7,0,0,0,241.86,106.43Zm-22.63,33.18-26.88,15.28a11.94,11.94,0,0,0-4.55,4.59c-.54,1-1.11,1.93-1.7,2.88a12,12,0,0,0-1.83,6.31L184.13,199a91.83,91.83,0,0,1-21.07,11.87l-27.15-15.19a12,12,0,0,0-5.86-1.53h-.29c-1.14,0-2.3,0-3.44,0a12.08,12.08,0,0,0-6.14,1.51L93,210.82A92.27,92.27,0,0,1,71.88,199l-.11-30.24a12,12,0,0,0-1.83-6.32c-.58-.94-1.16-1.91-1.7-2.88A11.92,11.92,0,0,0,63.7,155L36.8,139.63a86.53,86.53,0,0,1,0-23.24l26.88-15.28a12,12,0,0,0,4.55-4.58c.54-1,1.11-1.94,1.7-2.89a12,12,0,0,0,1.83-6.31L71.87,57A91.83,91.83,0,0,1,92.94,45.17l27.15,15.19a11.92,11.92,0,0,0,6.15,1.52c1.14,0,2.3,0,3.44,0a12.08,12.08,0,0,0,6.14-1.51L163,45.18A92.27,92.27,0,0,1,184.12,57l.11,30.24a12,12,0,0,0,1.83,6.32c.58.94,1.16,1.91,1.7,2.88A11.92,11.92,0,0,0,192.3,101l26.9,15.33A86.53,86.53,0,0,1,219.23,139.61Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M230.1,108.76,198.25,90.62c-.64-1.16-1.31-2.29-2-3.41l-.12-36A104.61,104.61,0,0,0,162,32L130,49.89c-1.34,0-2.69,0-4,0L94,32A104.58,104.58,0,0,0,59.89,51.25l-.16,36c-.7,1.12-1.37,2.26-2,3.41l-31.84,18.1a99.15,99.15,0,0,0,0,38.46l31.85,18.14c.64,1.16,1.31,2.29,2,3.41l.12,36A104.61,104.61,0,0,0,94,224l32-17.87c1.34,0,2.69,0,4,0L162,224a104.58,104.58,0,0,0,34.08-19.25l.16-36c.7-1.12,1.37-2.26,2-3.41l31.84-18.1A99.15,99.15,0,0,0,230.1,108.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm109.94-52.79a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21Zm-15,34.91-28.57,16.25a8,8,0,0,0-3,3c-.58,1-1.19,2.06-1.81,3.06a7.94,7.94,0,0,0-1.22,4.21l-.15,32.25a95.89,95.89,0,0,1-25.37,14.3L134,199.13a8,8,0,0,0-3.91-1h-.19c-1.21,0-2.43,0-3.64,0a8.1,8.1,0,0,0-4.1,1l-28.84,16.1A96,96,0,0,1,67.88,201l-.11-32.2a8,8,0,0,0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.09,8.09,0,0,0-3-3.06l-28.6-16.29a90.49,90.49,0,0,1,0-28.26L61.67,97.63a8,8,0,0,0,3-3c.58-1,1.19-2.06,1.81-3.06a7.94,7.94,0,0,0,1.22-4.21l.15-32.25a95.89,95.89,0,0,1,25.37-14.3L122,56.87a8,8,0,0,0,4.1,1c1.21,0,2.43,0,3.64,0a8,8,0,0,0,4.1-1l28.84-16.1A96,96,0,0,1,188.12,55l.11,32.2a8,8,0,0,0,1.22,4.22c.62,1,1.23,2,1.8,3.06a8.09,8.09,0,0,0,3,3.06l28.6,16.29A90.49,90.49,0,0,1,222.9,142.12Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M237.94,107.21a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A111.92,111.92,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.63a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,82a46,46,0,1,0,46,46A46.06,46.06,0,0,0,128,82Zm0,80a34,34,0,1,1,34-34A34,34,0,0,1,128,162Zm108-54.4a6,6,0,0,0-2.92-4L202.64,86.22l-.42-.71L202.1,51.2A6,6,0,0,0,200,46.64a110.12,110.12,0,0,0-36.07-20.31,6,6,0,0,0-4.84.45L128.46,43.86h-1L96.91,26.76a6,6,0,0,0-4.86-.44A109.92,109.92,0,0,0,56,46.68a6,6,0,0,0-2.12,4.55l-.16,34.34c-.14.23-.28.47-.41.71L22.91,103.57A6,6,0,0,0,20,107.62a104.81,104.81,0,0,0,0,40.78,6,6,0,0,0,2.92,4l30.42,17.33.42.71.12,34.31A6,6,0,0,0,56,209.36a110.12,110.12,0,0,0,36.07,20.31,6,6,0,0,0,4.84-.45l30.61-17.08h1l30.56,17.1A6.09,6.09,0,0,0,162,230a5.83,5.83,0,0,0,1.93-.32,109.92,109.92,0,0,0,36-20.36,6,6,0,0,0,2.12-4.55l.16-34.34c.14-.23.28-.47.41-.71l30.42-17.29a6,6,0,0,0,2.92-4.05A104.81,104.81,0,0,0,236,107.6Zm-11.25,35.79L195.32,160.1a6.07,6.07,0,0,0-2.28,2.3c-.59,1-1.21,2.11-1.86,3.14a6,6,0,0,0-.91,3.16l-.16,33.21a98.15,98.15,0,0,1-27.52,15.53L133,200.88a6,6,0,0,0-2.93-.77h-.14c-1.24,0-2.5,0-3.74,0a6,6,0,0,0-3.07.76L93.45,217.43a98,98,0,0,1-27.56-15.49l-.12-33.17a6,6,0,0,0-.91-3.16c-.64-1-1.27-2.08-1.86-3.14a6,6,0,0,0-2.27-2.3L31.3,143.4a93,93,0,0,1,0-30.79L60.68,95.9A6.07,6.07,0,0,0,63,93.6c.59-1,1.21-2.11,1.86-3.14a6,6,0,0,0,.91-3.16l.16-33.21A98.15,98.15,0,0,1,93.41,38.56L123,55.12a5.81,5.81,0,0,0,3.07.76c1.24,0,2.5,0,3.74,0a6,6,0,0,0,3.07-.76l29.65-16.56a98,98,0,0,1,27.56,15.49l.12,33.17a6,6,0,0,0,.91,3.16c.64,1,1.27,2.08,1.86,3.14a6,6,0,0,0,2.27,2.3L224.7,112.6A93,93,0,0,1,224.73,143.39Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm109.94-52.79a8,8,0,0,0-3.89-5.4l-29.83-17-.12-33.62a8,8,0,0,0-2.83-6.08,111.91,111.91,0,0,0-36.72-20.67,8,8,0,0,0-6.46.59L128,41.85,97.88,25a8,8,0,0,0-6.47-.6A112.1,112.1,0,0,0,54.73,45.15a8,8,0,0,0-2.83,6.07l-.15,33.65-29.83,17a8,8,0,0,0-3.89,5.4,106.47,106.47,0,0,0,0,41.56,8,8,0,0,0,3.89,5.4l29.83,17,.12,33.62a8,8,0,0,0,2.83,6.08,111.91,111.91,0,0,0,36.72,20.67,8,8,0,0,0,6.46-.59L128,214.15,158.12,231a7.91,7.91,0,0,0,3.9,1,8.09,8.09,0,0,0,2.57-.42,112.1,112.1,0,0,0,36.68-20.73,8,8,0,0,0,2.83-6.07l.15-33.65,29.83-17a8,8,0,0,0,3.89-5.4A106.47,106.47,0,0,0,237.94,107.21Zm-15,34.91-28.57,16.25a8,8,0,0,0-3,3c-.58,1-1.19,2.06-1.81,3.06a7.94,7.94,0,0,0-1.22,4.21l-.15,32.25a95.89,95.89,0,0,1-25.37,14.3L134,199.13a8,8,0,0,0-3.91-1h-.19c-1.21,0-2.43,0-3.64,0a8.08,8.08,0,0,0-4.1,1l-28.84,16.1A96,96,0,0,1,67.88,201l-.11-32.2a8,8,0,0,0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.09,8.09,0,0,0-3-3.06l-28.6-16.29a90.49,90.49,0,0,1,0-28.26L61.67,97.63a8,8,0,0,0,3-3c.58-1,1.19-2.06,1.81-3.06a7.94,7.94,0,0,0,1.22-4.21l.15-32.25a95.89,95.89,0,0,1,25.37-14.3L122,56.87a8,8,0,0,0,4.1,1c1.21,0,2.43,0,3.64,0a8.08,8.08,0,0,0,4.1-1l28.84-16.1A96,96,0,0,1,188.12,55l.11,32.2a8,8,0,0,0,1.22,4.22c.62,1,1.23,2,1.8,3.06a8.09,8.09,0,0,0,3,3.06l28.6,16.29A90.49,90.49,0,0,1,222.9,142.12Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,80a36,36,0,1,1,36-36A36,36,0,0,1,128,164Zm106-56a4,4,0,0,0-2-2.7l-30.89-17.6q-.47-.82-1-1.62L200.1,51.2a3.94,3.94,0,0,0-1.42-3,107.8,107.8,0,0,0-35.41-19.94,4,4,0,0,0-3.23.29L129,45.87h-2l-31-17.36a4,4,0,0,0-3.23-.3,108.05,108.05,0,0,0-35.39,20,4,4,0,0,0-1.41,3l-.16,34.9-1,1.62L23.9,105.3A4,4,0,0,0,22,108a102.76,102.76,0,0,0,0,40,4,4,0,0,0,1.95,2.7l30.89,17.6q.47.83,1,1.62l.12,34.87a3.94,3.94,0,0,0,1.42,3,107.8,107.8,0,0,0,35.41,19.94,4,4,0,0,0,3.23-.29L127,210.13h2l31,17.36a4,4,0,0,0,3.23.3,108.05,108.05,0,0,0,35.39-20,4,4,0,0,0,1.41-3l.16-34.9,1-1.62L232.1,150.7a4,4,0,0,0,2-2.71A102.76,102.76,0,0,0,234,108Zm-7.48,36.67L196.3,161.84a4,4,0,0,0-1.51,1.53c-.61,1.09-1.25,2.17-1.91,3.24a3.92,3.92,0,0,0-.61,2.1l-.16,34.15a99.8,99.8,0,0,1-29.7,16.77l-30.4-17a4.06,4.06,0,0,0-2-.51H130c-1.28,0-2.57,0-3.84,0a4.1,4.1,0,0,0-2.05.51l-30.45,17A100.23,100.23,0,0,1,63.89,202.9l-.12-34.12a3.93,3.93,0,0,0-.61-2.11c-.66-1-1.3-2.14-1.91-3.23a4,4,0,0,0-1.51-1.53L29.49,144.68a94.78,94.78,0,0,1,0-33.34L59.7,94.16a4,4,0,0,0,1.51-1.53c.61-1.09,1.25-2.17,1.91-3.23a4,4,0,0,0,.61-2.11l.16-34.15a99.8,99.8,0,0,1,29.7-16.77l30.4,17a4.1,4.1,0,0,0,2.05.51c1.28,0,2.57,0,3.84,0a4,4,0,0,0,2.05-.51l30.45-17A100.23,100.23,0,0,1,192.11,53.1l.12,34.12a3.93,3.93,0,0,0,.61,2.11c.66,1,1.3,2.14,1.91,3.23a4,4,0,0,0,1.51,1.53l30.25,17.23A94.78,94.78,0,0,1,226.54,144.66Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/GearSix.es.js
const o$6 = e$30.forwardRef((r, a) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: a,
	...r,
	weights: l
}));
o$6.displayName = "GearSixIcon";
const s$3 = o$6;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/CaretRight.es.js
const t = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M176,128,96,208V48Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34ZM104,188.69V67.31L164.69,128Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M181.66,133.66l-80,80A8,8,0,0,1,88,208V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,181.66,133.66Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M178.83,130.83l-80,80a4,4,0,0,1-5.66-5.66L170.34,128,93.17,50.83a4,4,0,0,1,5.66-5.66l80,80A4,4,0,0,1,178.83,130.83Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/CaretRight.es.js
const e$7 = e$30.forwardRef((o, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...o,
	weights: t
}));
e$7.displayName = "CaretRightIcon";
const s$2 = e$7;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Eye.es.js
const a$3 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M251,123.13c-.37-.81-9.13-20.26-28.48-39.61C196.63,57.67,164,44,128,44S59.37,57.67,33.51,83.52C14.16,102.87,5.4,122.32,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212s68.63-13.66,94.48-39.51c19.36-19.35,28.12-38.79,28.49-39.61A12.08,12.08,0,0,0,251,123.13Zm-46.06,33C183.47,177.27,157.59,188,128,188s-55.47-10.73-76.91-31.88A130.36,130.36,0,0,1,29.52,128,130.45,130.45,0,0,1,51.09,99.89C72.54,78.73,98.41,68,128,68s55.46,10.73,76.91,31.89A130.36,130.36,0,0,1,226.48,128,130.45,130.45,0,0,1,204.91,156.12ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,148Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Zm0,112a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M245.48,125.57c-.34-.78-8.66-19.23-27.24-37.81C201,70.54,171.38,50,128,50S55,70.54,37.76,87.76c-18.58,18.58-26.9,37-27.24,37.81a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206s73-20.53,90.24-37.75c18.58-18.58,26.9-37,27.24-37.8A6,6,0,0,0,245.48,125.57ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.77,134.77,0,0,1,22.69,128,134.56,134.56,0,0,1,46.55,95.94C69.22,73.42,96.62,62,128,62s58.78,11.42,81.45,33.94A134.56,134.56,0,0,1,233.31,128C226.94,140.21,195,194,128,194Zm0-112a46,46,0,1,0,46,46A46.06,46.06,0,0,0,128,82Zm0,80a34,34,0,1,1,34-34A34,34,0,0,1,128,162Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M243.66,126.38c-.34-.76-8.52-18.89-26.83-37.2C199.87,72.22,170.7,52,128,52S56.13,72.22,39.17,89.18c-18.31,18.31-26.49,36.44-26.83,37.2a4.08,4.08,0,0,0,0,3.25c.34.77,8.52,18.89,26.83,37.2,17,17,46.14,37.17,88.83,37.17s71.87-20.21,88.83-37.17c18.31-18.31,26.49-36.43,26.83-37.2A4.08,4.08,0,0,0,243.66,126.38Zm-32.7,35c-23.07,23-51,34.62-83,34.62s-59.89-11.65-83-34.62A135.71,135.71,0,0,1,20.44,128,135.69,135.69,0,0,1,45,94.62C68.11,71.65,96,60,128,60s59.89,11.65,83,34.62A135.79,135.79,0,0,1,235.56,128,135.71,135.71,0,0,1,211,161.38ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,80a36,36,0,1,1,36-36A36,36,0,0,1,128,164Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Eye.es.js
const o$5 = e$30.forwardRef((r, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...r,
	weights: a$3
}));
o$5.displayName = "EyeIcon";
const n$1 = o$5;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/EyeSlash.es.js
const e$6 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M56.88,31.93A12,12,0,1,0,39.12,48.07l16,17.65C20.67,88.66,5.72,121.58,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212a131.34,131.34,0,0,0,51-10l20.09,22.1a12,12,0,0,0,17.76-16.14ZM128,188c-29.59,0-55.47-10.73-76.91-31.88A130.69,130.69,0,0,1,29.52,128c5.27-9.31,18.79-29.9,42-44.29l90.09,99.11A109.33,109.33,0,0,1,128,188Zm123-55.12c-.36.81-9,20-28,39.16a12,12,0,1,1-17-16.9A130.48,130.48,0,0,0,226.48,128a130.36,130.36,0,0,0-21.57-28.12C183.46,78.73,157.59,68,128,68c-3.35,0-6.7.14-10,.42a12,12,0,1,1-2-23.91c3.93-.34,8-.51,12-.51,36,0,68.63,13.67,94.49,39.52,19.35,19.35,28.11,38.8,28.48,39.61A12.08,12.08,0,0,1,251,132.88Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M128,56C48,56,16,128,16,128s32,72,112,72,112-72,112-72S208,56,128,56Zm0,112a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M96.68,57.87a4,4,0,0,1,2.08-6.6A130.13,130.13,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41a8,8,0,0,1,0,6.5c-.35.79-8.82,19.57-27.65,38.4q-4.28,4.26-8.79,8.07a4,4,0,0,1-5.55-.36ZM213.92,210.62a8,8,0,1,1-11.84,10.76L180,197.13A127.21,127.21,0,0,1,128,208c-34.88,0-66.57-13.26-91.66-38.34C17.51,150.83,9,132.05,8.69,131.26a8,8,0,0,1,0-6.5C9,124,17.51,105.18,36.34,86.35a135,135,0,0,1,25-19.78L42.08,45.38A8,8,0,1,1,53.92,34.62Zm-65.49-48.25-52.69-58a40,40,0,0,0,52.69,58Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M52.44,36A6,6,0,0,0,43.56,44L64.44,67c-37.28,21.9-53.23,57-53.92,58.57a6,6,0,0,0,0,4.88c.34.77,8.66,19.22,27.24,37.8C55,185.47,84.62,206,128,206a124.91,124.91,0,0,0,52.57-11.25l23,25.29a6,6,0,0,0,8.88-8.08Zm48.62,71.32,45,49.52a34,34,0,0,1-45-49.52ZM128,194c-31.38,0-58.78-11.42-81.45-33.93A134.57,134.57,0,0,1,22.69,128c4.29-8.2,20.1-35.18,50-51.91L92.89,98.3a46,46,0,0,0,61.35,67.48l17.81,19.6A113.47,113.47,0,0,1,128,194Zm6.4-99.4a6,6,0,0,1,2.25-11.79,46.17,46.17,0,0,1,37.15,40.87,6,6,0,0,1-5.42,6.53l-.56,0a6,6,0,0,1-6-5.45A34.1,34.1,0,0,0,134.4,94.6Zm111.08,35.85c-.41.92-10.37,23-32.86,43.12a6,6,0,1,1-8-8.94A134.07,134.07,0,0,0,233.31,128a134.67,134.67,0,0,0-23.86-32.07C186.78,73.42,159.38,62,128,62a120.19,120.19,0,0,0-19.69,1.6,6,6,0,1,1-2-11.83A131.12,131.12,0,0,1,128,50c43.38,0,73,20.54,90.24,37.76,18.58,18.58,26.9,37,27.24,37.81A6,6,0,0,1,245.48,130.45Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M51,37.31A4,4,0,0,0,45,42.69L67.59,67.5C29.34,89,13,124.81,12.34,126.38a4.08,4.08,0,0,0,0,3.25c.34.77,8.52,18.89,26.83,37.2,17,17,46.14,37.17,88.83,37.17a122.59,122.59,0,0,0,53.06-11.69l24,26.38a4,4,0,1,0,5.92-5.38ZM149.1,157.16A36,36,0,0,1,101,104.22ZM128,196c-32,0-59.89-11.65-83-34.62A135.81,135.81,0,0,1,20.44,128c3.65-7.23,20.09-36.81,52.68-54.43l22.45,24.7a44,44,0,0,0,59,64.83l20.89,23A114.94,114.94,0,0,1,128,196Zm6.78-103.36a4,4,0,0,1,1.49-7.86,44.15,44.15,0,0,1,35.54,39.09,4,4,0,0,1-3.61,4.35l-.38,0a4,4,0,0,1-4-3.63A36.1,36.1,0,0,0,134.78,92.64Zm108.88,37c-.41.91-10.2,22.58-32.38,42.45a4,4,0,0,1-2.67,1,4,4,0,0,1-2.67-7A136.71,136.71,0,0,0,235.56,128,136.07,136.07,0,0,0,211,94.62C187.89,71.65,160,60,128,60a122,122,0,0,0-20,1.63,4,4,0,0,1-1.32-7.89A129.3,129.3,0,0,1,128,52c42.7,0,71.87,20.22,88.83,37.18,18.31,18.31,26.49,36.44,26.83,37.2A4.08,4.08,0,0,1,243.66,129.63Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/EyeSlash.es.js
const o$4 = e$30.forwardRef((a, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...a,
	weights: e$6
}));
o$4.displayName = "EyeSlashIcon";
const n = o$4;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Envelope.es.js
const a$2 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,44H32A12,12,0,0,0,20,56V192a20,20,0,0,0,20,20H216a20,20,0,0,0,20-20V56A12,12,0,0,0,224,44Zm-96,83.72L62.85,68h130.3ZM92.79,128,44,172.72V83.28Zm17.76,16.28,9.34,8.57a12,12,0,0,0,16.22,0l9.34-8.57L193.15,188H62.85ZM163.21,128,212,83.28v89.44Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M224,56l-96,88L32,56Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,50H32a6,6,0,0,0-6,6V192a14,14,0,0,0,14,14H216a14,14,0,0,0,14-14V56A6,6,0,0,0,224,50Zm-96,85.86L47.42,62H208.58ZM101.67,128,38,186.36V69.64Zm8.88,8.14L124,148.42a6,6,0,0,0,8.1,0l13.4-12.28L208.58,194H47.43ZM154.33,128,218,69.64V186.36Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,52H32a4,4,0,0,0-4,4V192a12,12,0,0,0,12,12H216a12,12,0,0,0,12-12V56A4,4,0,0,0,224,52Zm-96,86.57L42.28,60H213.72ZM104.63,128,36,190.91V65.09Zm5.92,5.43L125.3,147a4,4,0,0,0,5.4,0l14.75-13.52L213.72,196H42.28ZM151.37,128,220,65.09V190.91Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Envelope.es.js
const o$3 = e$30.forwardRef((r, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...r,
	weights: a$2
}));
o$3.displayName = "EnvelopeIcon";
const c$3 = o$3;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Bell.es.js
const e$5 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M225.29,165.93C216.61,151,212,129.57,212,104a84,84,0,0,0-168,0c0,25.58-4.59,47-13.27,61.93A20.08,20.08,0,0,0,30.66,186,19.77,19.77,0,0,0,48,196H84.18a44,44,0,0,0,87.64,0H208a19.77,19.77,0,0,0,17.31-10A20.08,20.08,0,0,0,225.29,165.93ZM128,212a20,20,0,0,1-19.6-16h39.2A20,20,0,0,1,128,212ZM54.66,172C63.51,154,68,131.14,68,104a60,60,0,0,1,120,0c0,27.13,4.48,50,13.33,68Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M220.07,176.94C214.41,167.2,206,139.73,206,104a78,78,0,1,0-156,0c0,35.74-8.42,63.2-14.08,72.94A14,14,0,0,0,48,198H90.48a38,38,0,0,0,75,0H208a14,14,0,0,0,12.06-21.06ZM128,218a26,26,0,0,1-25.29-20h50.58A26,26,0,0,1,128,218Zm81.71-33a1.9,1.9,0,0,1-1.7,1H48a1.9,1.9,0,0,1-1.7-1,2,2,0,0,1,0-2C53.87,170,62,139.69,62,104a66,66,0,1,1,132,0c0,35.68,8.14,65.95,15.71,79A2,2,0,0,1,209.71,185Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M218.35,178C212.58,168,204,140.13,204,104a76,76,0,1,0-152,0c0,36.13-8.59,64-14.36,73.95A12,12,0,0,0,48,196H92.23a36,36,0,0,0,71.54,0H208A12,12,0,0,0,218.35,178ZM128,220a28,28,0,0,1-27.71-24h55.42A28,28,0,0,1,128,220Zm83.45-34a3.91,3.91,0,0,1-3.44,2H48a3.91,3.91,0,0,1-3.44-2,4,4,0,0,1,0-4C52,169.17,60,139.32,60,104a68,68,0,1,1,136,0c0,35.31,8,65.17,15.44,78A4,4,0,0,1,211.45,186Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Bell.es.js
const o$2 = e$30.forwardRef((r, t) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: t,
	...r,
	weights: e$5
}));
o$2.displayName = "BellIcon";
const s$1 = o$2;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/MagnifyingGlass.es.js
const a$1 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/MagnifyingGlass.es.js
const o$1 = e$30.forwardRef((s, n) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: n,
	...s,
	weights: a$1
}));
o$1.displayName = "MagnifyingGlassIcon";
const f = o$1;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/CheckCircle.es.js
const a = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M172.24,99.76a6,6,0,0,1,0,8.48l-56,56a6,6,0,0,1-8.48,0l-24-24a6,6,0,0,1,8.48-8.48L112,151.51l51.76-51.75A6,6,0,0,1,172.24,99.76ZM230,128A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M170.83,101.17a4,4,0,0,1,0,5.66l-56,56a4,4,0,0,1-5.66,0l-24-24a4,4,0,0,1,5.66-5.66L112,154.34l53.17-53.17A4,4,0,0,1,170.83,101.17ZM228,128A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/CheckCircle.es.js
const c$2 = e$30.forwardRef((o, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...o,
	weights: a
}));
c$2.displayName = "CheckCircleIcon";
const s = c$2;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/Warning.es.js
const e$4 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M240.26,186.1,152.81,34.23h0a28.74,28.74,0,0,0-49.62,0L15.74,186.1a27.45,27.45,0,0,0,0,27.71A28.31,28.31,0,0,0,40.55,228h174.9a28.31,28.31,0,0,0,24.79-14.19A27.45,27.45,0,0,0,240.26,186.1Zm-20.8,15.7a4.46,4.46,0,0,1-4,2.2H40.55a4.46,4.46,0,0,1-4-2.2,3.56,3.56,0,0,1,0-3.73L124,46.2a4.77,4.77,0,0,1,8,0l87.44,151.87A3.56,3.56,0,0,1,219.46,201.8ZM116,136V104a12,12,0,0,1,24,0v32a12,12,0,0,1-24,0Zm28,40a16,16,0,1,1-16-16A16,16,0,0,1,144,176Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M233.34,190.09,145.88,38.22h0a20.75,20.75,0,0,0-35.76,0L22.66,190.09a19.52,19.52,0,0,0,0,19.71A20.36,20.36,0,0,0,40.54,220H215.46a20.36,20.36,0,0,0,17.86-10.2A19.52,19.52,0,0,0,233.34,190.09ZM226.4,205.8a12.47,12.47,0,0,1-10.94,6.2H40.54a12.47,12.47,0,0,1-10.94-6.2,11.45,11.45,0,0,1,0-11.72L117.05,42.21a12.76,12.76,0,0,1,21.9,0L226.4,194.08A11.45,11.45,0,0,1,226.4,205.8ZM124,144V104a4,4,0,0,1,8,0v40a4,4,0,0,1-8,0Zm12,36a8,8,0,1,1-8-8A8,8,0,0,1,136,180Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/Warning.es.js
const r = e$30.forwardRef((n, a) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: a,
	...n,
	weights: e$4
}));
r.displayName = "WarningIcon";
const c$1 = r;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/FloppyDisk.es.js
const e$3 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M222.14,69.17,186.83,33.86A19.86,19.86,0,0,0,172.69,28H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V83.31A19.86,19.86,0,0,0,222.14,69.17ZM164,204H92V160h72Zm40,0H188V156a20,20,0,0,0-20-20H88a20,20,0,0,0-20,20v48H52V52H171l33,33ZM164,84a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h56A12,12,0,0,1,164,84Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,83.31V208a8,8,0,0,1-8,8H176V152a8,8,0,0,0-8-8H88a8,8,0,0,0-8,8v64H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H172.69a8,8,0,0,1,5.65,2.34l35.32,35.32A8,8,0,0,1,216,83.31Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM208,208H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M217.9,73.42,182.58,38.1a13.9,13.9,0,0,0-9.89-4.1H48A14,14,0,0,0,34,48V208a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V83.31A13.9,13.9,0,0,0,217.9,73.42ZM170,210H86V152a2,2,0,0,1,2-2h80a2,2,0,0,1,2,2Zm40-2a2,2,0,0,1-2,2H182V152a14,14,0,0,0-14-14H88a14,14,0,0,0-14,14v58H48a2,2,0,0,1-2-2V48a2,2,0,0,1,2-2H172.69a2,2,0,0,1,1.41.58L209.42,81.9a2,2,0,0,1,.58,1.41ZM158,72a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h56A6,6,0,0,1,158,72Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M216.49,74.83,181.17,39.51A11.93,11.93,0,0,0,172.69,36H48A12,12,0,0,0,36,48V208a12,12,0,0,0,12,12H208a12,12,0,0,0,12-12V83.31A11.93,11.93,0,0,0,216.49,74.83ZM172,212H84V152a4,4,0,0,1,4-4h80a4,4,0,0,1,4,4Zm40-4a4,4,0,0,1-4,4H180V152a12,12,0,0,0-12-12H88a12,12,0,0,0-12,12v60H48a4,4,0,0,1-4-4V48a4,4,0,0,1,4-4H172.69a4,4,0,0,1,2.82,1.17l35.32,35.32A4,4,0,0,1,212,83.31ZM156,72a4,4,0,0,1-4,4H96a4,4,0,0,1,0-8h56A4,4,0,0,1,156,72Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/FloppyDisk.es.js
const p = e$30.forwardRef((e, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...e,
	weights: e$3
}));
p.displayName = "FloppyDiskIcon";
const m$1 = p;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/CalendarBlank.es.js
const e$2 = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M216,48V88H40V48a8,8,0,0,1,8-8H208A8,8,0,0,1,216,48Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,34H182V24a6,6,0,0,0-12,0V34H86V24a6,6,0,0,0-12,0V34H48A14,14,0,0,0,34,48V208a14,14,0,0,0,14,14H208a14,14,0,0,0,14-14V48A14,14,0,0,0,208,34ZM48,46H74V56a6,6,0,0,0,12,0V46h84V56a6,6,0,0,0,12,0V46h26a2,2,0,0,1,2,2V82H46V48A2,2,0,0,1,48,46ZM208,210H48a2,2,0,0,1-2-2V94H210V208A2,2,0,0,1,208,210Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M208,36H180V24a4,4,0,0,0-8,0V36H84V24a4,4,0,0,0-8,0V36H48A12,12,0,0,0,36,48V208a12,12,0,0,0,12,12H208a12,12,0,0,0,12-12V48A12,12,0,0,0,208,36ZM48,44H76V56a4,4,0,0,0,8,0V44h88V56a4,4,0,0,0,8,0V44h28a4,4,0,0,1,4,4V84H44V48A4,4,0,0,1,48,44ZM208,212H48a4,4,0,0,1-4-4V92H212V208A4,4,0,0,1,208,212Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/CalendarBlank.es.js
const e$1 = e$30.forwardRef((o, r) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: r,
	...o,
	weights: e$2
}));
e$1.displayName = "CalendarBlankIcon";
const c = e$1;
//#endregion
//#region node_modules/@phosphor-icons/react/dist/defs/BellRinging.es.js
const e = /* @__PURE__ */ new Map([
	["bold", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M225.81,74.65A11.86,11.86,0,0,1,220.3,76a12,12,0,0,1-10.67-6.47,90.1,90.1,0,0,0-32-35.38,12,12,0,1,1,12.8-20.29,115.25,115.25,0,0,1,40.54,44.62A12,12,0,0,1,225.81,74.65ZM46.37,69.53a90.1,90.1,0,0,1,32-35.38A12,12,0,1,0,65.6,13.86,115.25,115.25,0,0,0,25.06,58.48a12,12,0,0,0,5.13,16.17A11.86,11.86,0,0,0,35.7,76,12,12,0,0,0,46.37,69.53Zm173.51,98.35A20,20,0,0,1,204,200H171.81a44,44,0,0,1-87.62,0H52a20,20,0,0,1-15.91-32.12c7.17-9.33,15.73-26.62,15.88-55.94A76,76,0,0,1,204,112C204.15,141.26,212.71,158.55,219.88,167.88ZM147.6,200H108.4a20,20,0,0,0,39.2,0Zm48.74-24c-8.16-13-16.19-33.57-16.34-63.94A52,52,0,1,0,76,112c-.15,30.42-8.18,51-16.34,64Z" }))],
	["duotone", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", {
		d: "M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,147.81,56,112a72,72,0,0,1,144,0c0,35.82,8.3,56.6,14.9,68A8,8,0,0,1,208,192Z",
		opacity: "0.2"
	}), /* @__PURE__ */ e$30.createElement("path", { d: "M224,71.1a8,8,0,0,1-10.78-3.42,94.13,94.13,0,0,0-33.46-36.91,8,8,0,1,1,8.54-13.54,111.46,111.46,0,0,1,39.12,43.09A8,8,0,0,1,224,71.1ZM35.71,72a8,8,0,0,0,7.1-4.32A94.13,94.13,0,0,1,76.27,30.77a8,8,0,1,0-8.54-13.54A111.46,111.46,0,0,0,28.61,60.32,8,8,0,0,0,35.71,72Zm186.1,103.94A16,16,0,0,1,208,200H167.2a40,40,0,0,1-78.4,0H48a16,16,0,0,1-13.79-24.06C43.22,160.39,48,138.28,48,112a80,80,0,0,1,160,0C208,138.27,212.78,160.38,221.81,175.94ZM150.62,200H105.38a24,24,0,0,0,45.24,0ZM208,184c-10.64-18.27-16-42.49-16-72a64,64,0,0,0-128,0c0,29.52-5.38,53.74-16,72Z" }))],
	["fill", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,71.1a8,8,0,0,1-10.78-3.42,94.13,94.13,0,0,0-33.46-36.91,8,8,0,1,1,8.54-13.54,111.46,111.46,0,0,1,39.12,43.09A8,8,0,0,1,224,71.1ZM35.71,72a8,8,0,0,0,7.1-4.32A94.13,94.13,0,0,1,76.27,30.77a8,8,0,1,0-8.54-13.54A111.46,111.46,0,0,0,28.61,60.32,8,8,0,0,0,35.71,72Zm186.1,103.94A16,16,0,0,1,208,200H167.2a40,40,0,0,1-78.4,0H48a16,16,0,0,1-13.79-24.06C43.22,160.39,48,138.28,48,112a80,80,0,0,1,160,0C208,138.27,212.78,160.38,221.81,175.94ZM150.62,200H105.38a24,24,0,0,0,45.24,0Z" }))],
	["light", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M223.05,69.33A6,6,0,0,1,215,66.76,96,96,0,0,0,180.8,29.08a6,6,0,0,1,6.4-10.15,109.26,109.26,0,0,1,38.41,42.31A6,6,0,0,1,223.05,69.33ZM41,66.76A96,96,0,0,1,75.2,29.08a6,6,0,0,0-6.4-10.15A109.26,109.26,0,0,0,30.39,61.24,6,6,0,1,0,41,66.76Zm179,110.18A14,14,0,0,1,208,198h-42.5a38,38,0,0,1-75,0H48a14,14,0,0,1-12.06-21.06C45.13,161.09,50,138.63,50,112a78,78,0,0,1,156,0C206,139,210.74,160.86,220.08,176.94ZM153.29,198H102.71a26,26,0,0,0,50.58,0Zm56.42-15C199.29,165,194,141.15,194,112a66,66,0,0,0-132,0c0,29.16-5.29,53-15.71,71a2,2,0,0,0,0,2,1.9,1.9,0,0,0,1.7,1H208a1.9,1.9,0,0,0,1.7-1A2,2,0,0,0,209.71,183Z" }))],
	["regular", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M224,71.1a8,8,0,0,1-10.78-3.42,94.13,94.13,0,0,0-33.46-36.91,8,8,0,1,1,8.54-13.54,111.46,111.46,0,0,1,39.12,43.09A8,8,0,0,1,224,71.1ZM35.71,72a8,8,0,0,0,7.1-4.32A94.13,94.13,0,0,1,76.27,30.77a8,8,0,1,0-8.54-13.54A111.46,111.46,0,0,0,28.61,60.32,8,8,0,0,0,35.71,72Zm186.1,103.94A16,16,0,0,1,208,200H167.2a40,40,0,0,1-78.4,0H48a16,16,0,0,1-13.79-24.06C43.22,160.39,48,138.28,48,112a80,80,0,0,1,160,0C208,138.27,212.78,160.38,221.81,175.94ZM150.62,200H105.38a24,24,0,0,0,45.24,0ZM208,184c-10.64-18.27-16-42.49-16-72a64,64,0,0,0-128,0c0,29.52-5.38,53.74-16,72Z" }))],
	["thin", /* @__PURE__ */ e$30.createElement(e$30.Fragment, null, /* @__PURE__ */ e$30.createElement("path", { d: "M222.13,67.55a3.94,3.94,0,0,1-1.84.45,4,4,0,0,1-3.55-2.16,99.41,99.41,0,0,0-34.87-38.46,4,4,0,1,1,4.26-6.76,107.34,107.34,0,0,1,37.71,41.54A4,4,0,0,1,222.13,67.55ZM39.26,65.84A99.41,99.41,0,0,1,74.13,27.38a4,4,0,0,0-4.26-6.76A107.34,107.34,0,0,0,32.16,62.16a4,4,0,0,0,1.71,5.39,3.94,3.94,0,0,0,1.84.45A4,4,0,0,0,39.26,65.84ZM218.36,178A12,12,0,0,1,208,196H163.77a36,36,0,0,1-71.54,0H48A12,12,0,0,1,37.64,178C47.17,161.56,52,139.37,52,112a76,76,0,0,1,152,0C204,139.36,208.83,161.55,218.36,178ZM155.71,196H100.29a28,28,0,0,0,55.42,0Zm55.73-14C201.19,164.34,196,140.79,196,112a68,68,0,0,0-136,0c0,28.8-5.19,52.34-15.44,70a4,4,0,0,0,0,4A3.89,3.89,0,0,0,48,188H208a3.89,3.89,0,0,0,3.43-2A4,4,0,0,0,211.44,182Z" }))]
]);
//#endregion
//#region node_modules/@phosphor-icons/react/dist/csr/BellRinging.es.js
const o = e$30.forwardRef((n, i) => /* @__PURE__ */ e$30.createElement(p$3, {
	ref: i,
	...n,
	weights: e
}));
o.displayName = "BellRingingIcon";
const m = o;
//#endregion
//#region src/components/customIcons.jsx
function glyph(viewBox, draw) {
	return function CustomGlyph({ size = 20, weight, ...rest }) {
		return /* @__PURE__ */ jsx("svg", {
			width: size,
			height: size,
			viewBox,
			xmlns: "http://www.w3.org/2000/svg",
			...rest,
			children: draw
		});
	};
}
const outline = {
	fill: "none",
	stroke: "currentColor",
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
const ProgramIcon = glyph("0 0 24 24", /* @__PURE__ */ jsxs("g", {
	...outline,
	strokeWidth: "1.8",
	children: [/* @__PURE__ */ jsx("path", { d: "M20 12V4C20 2.89543 19.1046 2 18 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V18.5" }), /* @__PURE__ */ jsx("path", { d: "M13 2V14L16.8182 11L20 14V5" })]
}));
const SubjectIcon = glyph("0 0 24 24", /* @__PURE__ */ jsx("path", {
	fill: "currentColor",
	d: "M13,16H3a1,1,0,0,0,0,2H13a1,1,0,0,0,0-2ZM3,8H21a1,1,0,0,0,0-2H3A1,1,0,0,0,3,8Zm18,3H3a1,1,0,0,0,0,2H21a1,1,0,0,0,0-2Z"
}));
const UnderReviewIcon = glyph("0 0 24 24", /* @__PURE__ */ jsx("g", {
	...outline,
	strokeWidth: "1.8",
	children: /* @__PURE__ */ jsx("path", { d: "M5.06152 12C5.55362 8.05369 8.92001 5 12.9996 5C17.4179 5 20.9996 8.58172 20.9996 13C20.9996 17.4183 17.4179 21 12.9996 21H8M13 13V9M11 3H15M3 15H8M5 18H10" })
}));
const ApprovedIcon = glyph("0 0 32 32", /* @__PURE__ */ jsxs("g", {
	fill: "currentColor",
	children: [/* @__PURE__ */ jsx("path", { d: "M16,1C7.729,1,1,7.729,1,16s6.729,15,15,15s15-6.729,15-15S24.271,1,16,1z M16,29C8.832,29,3,23.168,3,16S8.832,3,16,3 s13,5.832,13,13S23.168,29,16,29z" }), /* @__PURE__ */ jsx("path", { d: "M23.317,10.27l-10.004,9.36l-4.629-4.332c-0.403-0.377-1.035-0.356-1.413,0.047c-0.377,0.403-0.356,1.036,0.047,1.413 l5.313,4.971c0.192,0.18,0.438,0.27,0.683,0.27s0.491-0.09,0.683-0.27l10.688-10c0.403-0.377,0.424-1.01,0.047-1.413 C24.353,9.913,23.719,9.892,23.317,10.27z" })]
}));
const ReviseIcon = glyph("0 0 64 64", /* @__PURE__ */ jsxs("g", {
	...outline,
	strokeWidth: "4.5",
	children: [
		/* @__PURE__ */ jsx("path", { d: "M54.89,26.73A23.52,23.52,0,0,1,15.6,49" }),
		/* @__PURE__ */ jsx("path", { d: "M9,37.17a23.75,23.75,0,0,1-.53-5A23.51,23.51,0,0,1,48.3,15.2" }),
		/* @__PURE__ */ jsx("polyline", { points: "37.73 16.24 48.62 15.44 47.77 5.24" }),
		/* @__PURE__ */ jsx("polyline", { points: "25.91 47.76 15.03 48.56 15.88 58.76" })
	]
}));
const BinIcon = glyph("0 0 24 24", /* @__PURE__ */ jsxs("g", {
	fill: "currentColor",
	children: [
		/* @__PURE__ */ jsx("path", { d: "M1.5 3.75C1.08579 3.75 0.75 4.08579 0.75 4.5C0.75 4.91421 1.08579 5.25 1.5 5.25V3.75ZM22.5 5.25C22.9142 5.25 23.25 4.91421 23.25 4.5C23.25 4.08579 22.9142 3.75 22.5 3.75V5.25ZM1.5 5.25H22.5V3.75H1.5V5.25Z" }),
		/* @__PURE__ */ jsx("path", { d: "M9.75 1.5V0.75V1.5ZM8.25 3H7.5H8.25ZM7.5 4.5C7.5 4.91421 7.83579 5.25 8.25 5.25C8.66421 5.25 9 4.91421 9 4.5H7.5ZM15 4.5C15 4.91421 15.3358 5.25 15.75 5.25C16.1642 5.25 16.5 4.91421 16.5 4.5H15ZM15.75 3H16.5H15.75ZM14.25 0.75H9.75V2.25H14.25V0.75ZM9.75 0.75C9.15326 0.75 8.58097 0.987053 8.15901 1.40901L9.21967 2.46967C9.36032 2.32902 9.55109 2.25 9.75 2.25V0.75ZM8.15901 1.40901C7.73705 1.83097 7.5 2.40326 7.5 3H9C9 2.80109 9.07902 2.61032 9.21967 2.46967L8.15901 1.40901ZM7.5 3V4.5H9V3H7.5ZM16.5 4.5V3H15V4.5H16.5ZM16.5 3C16.5 2.40326 16.2629 1.83097 15.841 1.40901L14.7803 2.46967C14.921 2.61032 15 2.80109 15 3H16.5ZM15.841 1.40901C15.419 0.987053 14.8467 0.75 14.25 0.75V2.25C14.4489 2.25 14.6397 2.32902 14.7803 2.46967L15.841 1.40901Z" }),
		/* @__PURE__ */ jsx("path", { d: "M9 17.25C9 17.6642 9.33579 18 9.75 18C10.1642 18 10.5 17.6642 10.5 17.25H9ZM10.5 9.75C10.5 9.33579 10.1642 9 9.75 9C9.33579 9 9 9.33579 9 9.75H10.5ZM10.5 17.25V9.75H9V17.25H10.5Z" }),
		/* @__PURE__ */ jsx("path", { d: "M13.5 17.25C13.5 17.6642 13.8358 18 14.25 18C14.6642 18 15 17.6642 15 17.25H13.5ZM15 9.75C15 9.33579 14.6642 9 14.25 9C13.8358 9 13.5 9.33579 13.5 9.75H15ZM15 17.25V9.75H13.5V17.25H15Z" }),
		/* @__PURE__ */ jsx("path", { d: "M18.865 21.124L18.1176 21.0617L18.1176 21.062L18.865 21.124ZM17.37 22.5L17.3701 21.75H17.37V22.5ZM6.631 22.5V21.75H6.63093L6.631 22.5ZM5.136 21.124L5.88343 21.062L5.88341 21.0617L5.136 21.124ZM4.49741 4.43769C4.46299 4.0249 4.10047 3.71818 3.68769 3.75259C3.2749 3.78701 2.96818 4.14953 3.00259 4.56231L4.49741 4.43769ZM20.9974 4.56227C21.0318 4.14949 20.7251 3.78698 20.3123 3.75259C19.8995 3.7182 19.537 4.02495 19.5026 4.43773L20.9974 4.56227ZM18.1176 21.062C18.102 21.2495 18.0165 21.4244 17.878 21.5518L18.8939 22.6555C19.3093 22.2732 19.5658 21.7486 19.6124 21.186L18.1176 21.062ZM17.878 21.5518C17.7396 21.6793 17.5583 21.75 17.3701 21.75L17.3699 23.25C17.9345 23.25 18.4785 23.0379 18.8939 22.6555L17.878 21.5518ZM17.37 21.75H6.631V23.25H17.37V21.75ZM6.63093 21.75C6.44274 21.75 6.26142 21.6793 6.12295 21.5518L5.10713 22.6555C5.52253 23.0379 6.06649 23.25 6.63107 23.25L6.63093 21.75ZM6.12295 21.5518C5.98449 21.4244 5.89899 21.2495 5.88343 21.062L4.38857 21.186C4.43524 21.7486 4.69172 22.2732 5.10713 22.6555L6.12295 21.5518ZM5.88341 21.0617L4.49741 4.43769L3.00259 4.56231L4.38859 21.1863L5.88341 21.0617ZM19.5026 4.43773L18.1176 21.0617L19.6124 21.1863L20.9974 4.56227L19.5026 4.43773Z" })
	]
}));
const PencilSquareIcon = glyph("0 0 24 24", /* @__PURE__ */ jsx("path", {
	...outline,
	strokeWidth: "1.5",
	d: "M12 5H9C7.11438 5 6.17157 5 5.58579 5.58579C5 6.17157 5 7.11438 5 9V15C5 16.8856 5 17.8284 5.58579 18.4142C6.17157 19 7.11438 19 9 19H15C16.8856 19 17.8284 19 18.4142 18.4142C19 17.8284 19 16.8856 19 15V12M9.31899 12.6911L15.2486 6.82803C15.7216 6.36041 16.4744 6.33462 16.9782 6.76876C17.5331 7.24688 17.5723 8.09299 17.064 8.62034L11.2329 14.6702L9 15L9.31899 12.6911Z"
}));
const DeniedIcon = glyph("0 0 329.328 329.328", /* @__PURE__ */ jsx("path", {
	fill: "currentColor",
	d: "M164.666,0C73.871,0,0.004,73.871,0.004,164.672c0.009,90.792,73.876,164.656,164.662,164.656 c90.793,0,164.658-73.865,164.658-164.658C329.324,73.871,255.459,0,164.666,0z M164.666,30c31.734,0,60.933,11.042,83.975,29.477 L59.478,248.638c-18.431-23.04-29.471-52.237-29.474-83.967C30.004,90.413,90.413,30,164.666,30z M164.666,299.328 c-31.733,0-60.934-11.042-83.977-29.477L269.854,80.691c18.431,23.043,29.471,52.244,29.471,83.979 C299.324,238.921,238.917,299.328,164.666,299.328z"
}));
//#endregion
//#region src/components/ui.jsx
function Field({ label, full, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: full ? "field full" : "field",
		children: [/* @__PURE__ */ jsx("span", { children: label }), children]
	});
}
function PageHead({ title, subtitle, actions }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "page-head",
		children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", { children: title }), /* @__PURE__ */ jsx("p", { children: subtitle })] }), /* @__PURE__ */ jsx("div", {
			className: "page-actions",
			children: actions
		})]
	});
}
const ICONS = {
	signOut: c$4,
	arrowUpRight: c$7,
	arrowUUpLeft: c$6,
	xCircle: s$9,
	chatText: s$8,
	clockBack: a$7,
	notebook: n$6,
	sealCheck: n$5,
	hourglassMedium: c$5,
	notePencil: m$3,
	shieldCheck: h,
	graduationCap: p$1,
	paperPlaneTilt: m$2,
	uploadSimple: l$4,
	squaresFour: n$4,
	pencilRuler: l$3,
	sparkle: s$6,
	gridFour: s$5,
	archive: s$4,
	chartBar: n$3,
	downloadSimple: l$1,
	usersThree: n$2,
	gearSix: s$3,
	caretRight: s$2,
	eye: n$1,
	eyeSlash: n,
	envelope: c$3,
	bell: s$1,
	magnifyingGlass: f,
	checkCircle: s,
	warning: c$1,
	floppyDisk: m$1,
	calendarBlank: c,
	bellRinging: m,
	program: ProgramIcon,
	subject: SubjectIcon,
	underReview: UnderReviewIcon,
	approved: ApprovedIcon,
	revise: ReviseIcon,
	bin: BinIcon,
	pencilSquare: PencilSquareIcon,
	denied: DeniedIcon
};
function Icon({ name, size = 20, weight = "duotone", label, className, ...rest }) {
	const Glyph = ICONS[name];
	if (!Glyph) return null;
	return /* @__PURE__ */ jsx(Glyph, {
		size,
		weight,
		className,
		...label ? {
			role: "img",
			"aria-label": label
		} : { "aria-hidden": "true" },
		...rest
	});
}
//#endregion
//#region src/data/outcomesSeed.js
const INSTITUTION = {
	vision: "Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, rooted in Gospel values as a Catholic Augustinian-Marian institution, envisions to become a catalyst for the holistic transformation of all persons and communities.",
	mission: {
		lead: "LCUP commits to generate and make available to all persons and communities’ programs and services that will enable them to:",
		items: [
			"exhibit academic and technical competence in their respective areas of discipline in the local and international environment;",
			"demonstrate their knowledge, critical thinking and creativity by exploring the various avenues of learning and searching for truth;",
			"manifest their willingness to serve specially the marginalized sector of our society;",
			"demonstrate productivity in various areas of learning as responsible citizens of the society; and",
			"live the Gospel values in the varied aspects of their personal and professional lives."
		]
	},
	egas: [
		{
			no: 1,
			name: "Critical and Creative thinker",
			short: "Critical and Creative Thinker"
		},
		{
			no: 2,
			name: "Competent Catholic Augustinian-Marian Professional",
			short: "Competent Professional"
		},
		{
			no: 3,
			name: "Socially Responsive Steward",
			short: "Socially Responsive Steward"
		},
		{
			no: 4,
			name: "Transformative Lifelong learner",
			short: "Transformative Lifelong Learner"
		}
	]
};
const PROGRAMS = {
	BSIT: {
		name: "BS Information Technology",
		pos: [
			{
				no: 1,
				short: "Apply computing knowledge",
				text: "Apply computing and other knowledge domains to address realworld problems.",
				egas: [1]
			},
			{
				no: 2,
				short: "Analyze and define requirements",
				text: "Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution.",
				egas: [1]
			},
			{
				no: 3,
				short: "Design computing solutions",
				text: "Design and develop computing solutions using a system-level perspective.",
				egas: [1]
			},
			{
				no: 4,
				short: "Ethical IT professional",
				text: "Demonstrate ethical behavior as an IT Professional and sensitivity to the impact of technology in the society.",
				egas: [2]
			},
			{
				no: 5,
				short: "Augustinian virtues and CSR",
				text: "Show Augustinian virtues/ethical values and the understanding and appreciation of corporate social responsibility.",
				egas: [2]
			},
			{
				no: 6,
				short: "Multi-disciplinary teamwork",
				text: "Work effectively and independently in multi-disciplinary and multi-cultural teams.",
				egas: [4]
			},
			{
				no: 7,
				short: "Impact on society",
				text: "Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community.",
				egas: [3]
			},
			{
				no: 8,
				short: "Latest developments in the field",
				text: "Articulate and discuss the latest developments in the specific field of practice.",
				egas: [1, 4]
			},
			{
				no: 9,
				short: "Professional and social ethics",
				text: "Act in recognition of professional, social and ethical.",
				egas: [2]
			},
			{
				no: 10,
				short: "Ethical leadership",
				text: "Demonstrate ethical leadership and social responsibility by integrating sustainability, inclusivity, mental well-being and peace-building principles into academic, professional and community engagements, ensuring holistic development and societal transformation.",
				egas: [3]
			}
		]
	},
	BSIS: {
		name: "BS Information Systems",
		pos: []
	},
	BSCS: {
		name: "BS Computer Science",
		pos: []
	},
	BLIS: {
		name: "BS Library and Information Science",
		pos: []
	},
	BSEMC: {
		name: "BS Entertainment and Multimedia Computing",
		pos: []
	}
};
//#endregion
//#region src/lib/schoolYear.js
const CURRENT_SCHOOL_YEAR = {
	label: "2026–2027",
	startYear: 2026
};
const COLLEGE_NAME = "College of Information Technology and Engineering";
const INSTITUTION_NAME = "La Consolacion University Philippines";
const INSTITUTION_ADDRESS = "Valenzuela St., Capitol View Park Subdivision, Bulihan, City of Malolos, Bulacan";
const LEVELS = [
	"Introductory",
	"Enabling",
	"Demonstrating",
	"Integration of Values"
];
const GROUPS = [
	["books", "Books"],
	["program", "Internet Programming"],
	["online", "Internet References"],
	["electronics", "Electronics"]
];
const PLAN_HEADINGS = {
	ilo: "Intended Learning Outcomes (ILO)",
	contents: "Course Contents",
	activities: "Suggested Learning Activities",
	tasks: "Suggested Assessment Tasks",
	values: "Expected Value/s To Be Integrated"
};
const STEPS = [
	{
		key: "info",
		title: "Course Information",
		form: "I–V",
		sub: "Identify the course. School year and college are filled in for you."
	},
	{
		key: "clos",
		title: "Learning Outcomes",
		form: "VI",
		sub: "The institution’s vision, mission, graduate attributes and program outcomes, then your course learning outcomes tagged to them."
	},
	{
		key: "plan",
		title: "Learning Plan",
		form: "VII",
		sub: "One row per week or week range. Tag every ILO with the outcomes it builds."
	},
	{
		key: "reqs",
		title: "Course Requirements",
		form: "VIII",
		sub: "What students must complete. Suggestions come from your assessment tasks."
	},
	{
		key: "refs",
		title: "References",
		form: "IX",
		sub: "Group references the way the form does. Older sources are marked."
	},
	{
		key: "grade",
		title: "Grading System",
		form: "X",
		sub: "Components must total 100%. The formulas follow from them and from your exam rows."
	},
	{
		key: "review",
		title: "Review & Check",
		form: "Form",
		sub: "Check the finished form against the template and read it through. Sign-off names are filled in by the system when it is reviewed and approved."
	}
];
function esc(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clone(o) {
	return JSON.parse(JSON.stringify(o));
}
function weekNums(str) {
	const out = [];
	String(str).replace(/week/gi, "").split(",").forEach((p) => {
		p = p.trim();
		const m = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
		if (m) for (let k = +m[1]; k <= +m[2] && k <= 60; k++) out.push(k);
		else if (/^\d+$/.test(p)) out.push(+p);
	});
	return out;
}
function weekSet(plan) {
	const s = {};
	plan.forEach((r) => weekNums(r.week).forEach((w) => {
		s[w] = 1;
	}));
	return s;
}
function parseTag(t) {
	const i = String(t).indexOf(":");
	return {
		kind: String(t).slice(0, i),
		id: String(t).slice(i + 1)
	};
}
const iloClos = (il) => il.tags.filter((t) => t.indexOf("clo:") === 0).map((t) => parseTag(t).id);
function lines$1(t) {
	return String(t || "").split(/\n/).map((x) => x.trim()).filter(Boolean);
}
function stripMarkup(s) {
	return s.replace(/^-\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
}
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
function renderMarkup(text) {
	let out = "";
	let ul = false;
	lines$1(text).forEach((l) => {
		if (/^-\s+/.test(l)) {
			if (!ul) {
				out += "<ul>";
				ul = true;
			}
			out += "<li>" + inline(l.replace(/^-\s+/, "")) + "</li>";
		} else {
			if (ul) {
				out += "</ul>";
				ul = false;
			}
			out += "<div>" + inline(l) + "</div>";
		}
	});
	if (ul) out += "</ul>";
	return out;
}
function abbr(label) {
	const w = String(label).trim().split(/\s+/).filter(Boolean);
	return w.length > 1 ? w.map((x) => x[0]).join("").toUpperCase() : String(label).slice(0, 2).toUpperCase();
}
function examName(row) {
	const t = lines$1(row.contents).map(stripMarkup).join(" ");
	if (/prelim/i.test(t)) return "Prelim Grade";
	if (/midterm/i.test(t)) return "Midterm Grade";
	if (/final/i.test(t)) return "Final Grade";
	return t ? t.charAt(0) + t.slice(1).toLowerCase() : "Exam";
}
const gradeTotal = (d) => d.grading.rows.reduce((s, g) => s + (Number(g.pct) || 0), 0);
const examRows = (d) => d.plan.filter((r) => r.kind === "exam");
const blank = (newId) => ({
	id: newId(),
	text: "",
	tags: []
});
function blankRow(newId, kind = "lesson") {
	return {
		id: newId(),
		kind,
		week: "",
		ilos: [blank(newId)],
		contents: "",
		activities: "",
		tasks: "",
		values: ""
	};
}
function emptyDraft(newId) {
	return {
		schemaVersion: 3,
		meta: {
			courseId: null,
			code: "",
			title: "",
			program: "",
			lecture: "",
			lab: "",
			prereq: ""
		},
		description: [{
			id: newId(),
			t: ""
		}],
		clos: [],
		plan: [blankRow(newId)],
		reqs: [],
		refs: {
			books: {
				na: false,
				items: []
			},
			program: {
				na: false,
				items: []
			},
			online: {
				na: false,
				items: []
			},
			electronics: {
				na: false,
				items: []
			}
		},
		grading: {
			rows: [],
			override: {
				on: false,
				term: "",
				final: ""
			}
		},
		signoff: {}
	};
}
function applyCourse(d, course) {
	const n = clone(d);
	n.meta.courseId = course.id;
	n.meta.code = course.code;
	n.meta.title = course.title;
	n.meta.program = course.program.code;
	if (d.meta.courseId === course.id && d.outcomes) return n;
	delete n.catalog;
	n.clos = clone(course.clos);
	const setup = course.standards || {
		vision: "",
		mission: {
			lead: "",
			items: []
		},
		egas: [],
		pos: []
	};
	n.outcomes = clone({
		vision: setup.vision,
		mission: setup.mission,
		egas: setup.egas,
		pos: setup.pos
	});
	const ids = new Set(n.clos.map((c) => c.id));
	n.plan.forEach((r) => r.ilos.forEach((il) => {
		il.tags = d.meta.courseId && d.meta.courseId !== course.id ? [] : il.tags.filter((t) => t.indexOf("clo:") !== 0 || ids.has(parseTag(t).id));
	}));
	return n;
}
function clearCourse(d) {
	const n = clone(d);
	n.meta.courseId = null;
	n.meta.code = "";
	n.meta.title = "";
	n.clos = [];
	n.outcomes = {
		vision: "",
		mission: {
			lead: "",
			items: []
		},
		egas: [],
		pos: []
	};
	delete n.catalog;
	n.plan.forEach((r) => r.ilos.forEach((il) => {
		il.tags = [];
	}));
	return n;
}
function hydrateContent(content, newId) {
	const base = emptyDraft(newId);
	const stored = migrateContent(content);
	return {
		...base,
		...stored,
		meta: {
			...base.meta,
			...stored.meta || {}
		},
		refs: {
			...base.refs,
			...stored.refs || {}
		},
		grading: {
			...base.grading,
			...stored.grading || {},
			override: {
				...base.grading.override,
				...(stored.grading || {}).override || {}
			}
		}
	};
}
function migrateContent(content) {
	const d = clone(content || {});
	if (!d.schemaVersion || d.schemaVersion < 2) (d.plan || []).forEach((r) => (r.ilos || []).forEach((il) => {
		const old = Array.isArray(il.clos) ? il.clos : [];
		const tags = Array.isArray(il.tags) ? il.tags : [];
		old.forEach((id) => {
			const t = "clo:" + id;
			if (tags.indexOf(t) < 0) tags.push(t);
		});
		il.tags = tags;
		delete il.clos;
	}));
	d.schemaVersion = 3;
	return d;
}
function createModel({ institution, programs, year }) {
	const institutionFor = (d) => d.outcomes || institution;
	const poList = (d) => d.outcomes?.pos || (programs[d.meta.program] || { pos: [] }).pos;
	const egaList = (d) => {
		if (d.outcomes) return d.outcomes.egas;
		const p = programs[d.meta.program];
		if (!p) return [];
		return Array.isArray(p.egas) ? p.egas : institution.egas;
	};
	const hasOutcomeSelection = (d) => !!(d.meta.program && (programs[d.meta.program] || d.outcomes) && (d.meta.courseId || d.catalog?.program?.code === d.meta.program));
	function tagInfo(d, t) {
		const p = parseTag(t);
		if (p.kind === "clo") {
			const i = d.clos.findIndex((c) => c.id === p.id);
			if (i < 0) return {
				ok: false,
				kind: "clo",
				idx: 0,
				no: "?",
				label: "CLO",
				name: "Removed outcome",
				text: ""
			};
			return {
				ok: true,
				kind: "clo",
				idx: i,
				no: i + 1,
				label: "CLO " + (i + 1),
				name: d.clos[i].title || "Untitled outcome",
				text: d.clos[i].statement
			};
		}
		if (p.kind === "ega") {
			const e = egaList(d).find((x) => String(x.no) === p.id);
			return e ? {
				ok: true,
				kind: "ega",
				no: e.no,
				label: "EGA " + e.no,
				name: e.short,
				text: e.name
			} : {
				ok: false,
				kind: "ega",
				no: p.id,
				label: "EGA " + p.id,
				name: "Not in the " + (d.meta.program || "program") + " EGA list",
				text: ""
			};
		}
		if (p.kind === "po") {
			const o = poList(d).find((x) => String(x.no) === p.id);
			return o ? {
				ok: true,
				kind: "po",
				no: o.no,
				label: "PO " + o.no,
				name: o.short,
				text: o.text
			} : {
				ok: false,
				kind: "po",
				no: p.id,
				label: "PO " + p.id,
				name: "Not in the " + d.meta.program + " list",
				text: ""
			};
		}
		return {
			ok: false,
			kind: p.kind,
			no: p.id,
			label: String(t),
			name: "Unknown tag",
			text: ""
		};
	}
	function rowHits(d, row) {
		if (row.kind !== "lesson") return [];
		return d.clos.filter((c) => row.ilos.some((il) => iloClos(il).indexOf(c.id) > -1)).map((c) => c.id);
	}
	function coverage(d) {
		return d.clos.map((c, i) => {
			const weeks = {};
			const rows = [];
			d.plan.forEach((r) => {
				if (rowHits(d, r).indexOf(c.id) > -1) {
					rows.push(r.id);
					weekNums(r.week).forEach((w) => {
						weeks[w] = 1;
					});
				}
			});
			return {
				id: c.id,
				n: i + 1,
				weeks: Object.keys(weeks).map(Number).sort((a, b) => a - b),
				rows
			};
		});
	}
	function removeClo(d, id) {
		const n = clone(d);
		let affected = 0;
		n.clos = n.clos.filter((c) => c.id !== id);
		n.plan.forEach((r) => r.ilos.forEach((il) => {
			const b = il.tags.length;
			il.tags = il.tags.filter((x) => x !== "clo:" + id);
			if (il.tags.length < b) affected++;
		}));
		return {
			draft: n,
			affected
		};
	}
	function impliedEgas(d, clo) {
		const s = {};
		clo.pos.forEach((no) => {
			const po = poList(d).find((x) => x.no === no);
			if (po) po.egas.forEach((e) => {
				s[e] = 1;
			});
		});
		return Object.keys(s).map(Number).sort((a, b) => a - b);
	}
	const missingEgas = (d, clo) => impliedEgas(d, clo).filter((e) => clo.egas.indexOf(e) < 0);
	function formulas(d) {
		const g = d.grading;
		const ex = examRows(d).map(examName);
		const term = "Term Grade = " + (g.rows.length ? g.rows.map((r) => (r.abbr || abbr(r.label)) + " (" + (Number(r.pct) || 0) + "%)").join(" + ") : "(add grading components)");
		const fin = "Final Rating = " + (ex.length ? ex.join(" + ") : "(add exam rows in step 3)");
		return {
			term: g.override.on ? g.override.term : term,
			final: g.override.on ? g.override.final : fin,
			genTerm: term,
			genFinal: fin
		};
	}
	function refAge(t) {
		const m = String(t).match(/\b(19|20)\d{2}\b/);
		return m ? {
			year: +m[0],
			age: year - +m[0]
		} : null;
	}
	function suggestReqs(d) {
		const have = {};
		d.reqs.forEach((r) => {
			have[r.t.trim().toLowerCase()] = 1;
		});
		const out = [];
		const seen = {};
		d.plan.forEach((r) => lines$1(r.tasks).forEach((l) => {
			if (!/^-\s+/.test(l)) return;
			const t = stripMarkup(l).replace(/^(visual|logical|applied|reflective)[^:]*:\s*/i, "");
			if (t.length < 4 || t.length > 60) return;
			const k = t.toLowerCase();
			if (have[k] || seen[k]) return;
			seen[k] = 1;
			out.push(t.charAt(0).toUpperCase() + t.slice(1));
		}));
		if (examRows(d).length && !have["examinations"] && !seen["examinations"]) out.unshift("Examinations");
		return out.slice(0, 8);
	}
	const blank = (v) => !String(v == null ? "" : v).trim();
	function issues(d, key) {
		const o = [];
		const form = (text, extra) => o.push({
			text,
			blocking: true,
			source: "form",
			...extra
		});
		const admin = (text, extra) => o.push({
			text: d.outcomes ? text.replace(" Please ask your administrator.", "") : text,
			blocking: true,
			source: d.outcomes ? "form" : "admin",
			...extra
		});
		const advice = (text, extra) => o.push({
			text,
			blocking: false,
			source: "form",
			...extra
		});
		if (key === "clos" && d.outcomes) {
			const own = d.outcomes;
			if (!d.meta.courseId) form("Choose a subject.");
			if (blank(own.vision)) form("Add the vision in step 2.");
			if (blank(own.mission.lead) || !own.mission.items.length || own.mission.items.some(blank)) form("Complete the mission in step 2.");
			if (!own.egas.length || own.egas.some((e) => blank(e.name) || blank(e.short))) form("Complete the EGA names and short names in step 2.");
			if (!own.pos.length || own.pos.some((p) => blank(p.text) || blank(p.short))) form("Complete the PO statements and short names in step 2.");
			if (!d.clos.length || d.clos.some((c) => blank(c.statement) || !LEVELS.includes(c.level) || !c.egas.length || !c.pos.length)) form("Complete the CLO statements and EGA and PO mappings in step 2.");
			if (own.pos.some((p) => p.egas.some((no) => !own.egas.some((e) => e.no === no))) || d.clos.some((c) => c.egas.some((no) => !own.egas.some((e) => e.no === no)) || c.pos.some((no) => !own.pos.some((p) => p.no === no)))) form("Fix the outcome mappings in step 2.");
			return o;
		}
		if (key === "info") {
			if (!d.meta.program) form("Choose a program.");
			else if (!d.meta.courseId) form("Choose a subject.");
			if (blank(d.meta.prereq)) form("Pre-requisite is empty.");
			if (isNaN(parseFloat(d.meta.lecture)) || isNaN(parseFloat(d.meta.lab))) form("Enter lecture and laboratory units.");
			if (!d.description.some((p) => p.t.trim())) form("Add at least one description paragraph.");
		}
		if (key === "clos") {
			const pos = poList(d);
			const egas = egaList(d);
			const program = d.meta.program || "this program";
			const own = institutionFor(d);
			if (blank(own.vision)) admin(d.outcomes ? "Add the vision in step 2." : "The vision has not been added yet. Please ask your administrator.");
			const mission = own.mission || {
				lead: "",
				items: []
			};
			if (blank(mission.lead) || !(mission.items || []).some((t) => !blank(t))) admin("The mission has not been added yet. Please ask your administrator.");
			if (!d.meta.courseId) form("Choose a subject in step 1 to load its learning outcomes.");
			if (d.meta.program) {
				if (!egas.length) admin("No graduate attributes (EGAs) have been added for " + program + " yet. Please ask your administrator.");
				if (!pos.length) admin("No program outcomes have been added for " + program + " yet. Please ask your administrator.");
			}
			if (d.meta.courseId && !d.clos.length) admin("No learning outcomes have been added for " + d.meta.code + " yet. Please ask your administrator.");
			d.clos.forEach((c, i) => {
				const n = "CLO " + (i + 1);
				if (blank(c.statement)) admin(n + " has no statement yet. Please ask your administrator.", { clo: c.id });
				if (!c.egas.length) admin(n + " has no graduate attribute (EGA) tag yet. Please ask your administrator.", { clo: c.id });
				if (!c.pos.length) admin(n + " has no program outcome tag yet. Please ask your administrator.", { clo: c.id });
				const bad = c.pos.filter((p) => !pos.some((x) => x.no === p));
				if (bad.length && pos.length) admin(n + " is tagged PO " + bad.join(", ") + ", which " + (bad.length > 1 ? "do" : "does") + " not exist in " + program + ". Please ask your administrator.", { clo: c.id });
				const badEga = c.egas.filter((g) => !egas.some((x) => x.no === g));
				if (badEga.length && egas.length) admin(n + " is tagged EGA " + badEga.join(", ") + ", which " + (badEga.length > 1 ? "do" : "does") + " not exist in " + program + ". Please ask your administrator.", { clo: c.id });
			});
		}
		if (key === "plan") {
			if (!d.plan.length) form("Add at least one week.");
			else if (!d.plan.some((r) => r.kind === "lesson" && r.ilos.some((il) => il.text.trim()))) form("Add at least one lesson with a learning outcome (ILO).");
			d.plan.forEach((r) => {
				if (blank(r.week)) form("A row has no week. Enter the week, or delete the row.", { row: r.id });
				if (r.kind !== "lesson") return;
				if (!r.ilos.some((il) => il.text.trim())) form("Week " + (r.week || "?") + " has no learning outcome (ILO).", { row: r.id });
				r.ilos.forEach((il, j) => {
					const w = "Week " + (r.week || "?") + ", ILO" + (j + 1);
					if (il.text.trim() && !iloClos(il).length) form(w + " has no CLO tag.", { row: r.id });
					if (!il.text.trim() && il.tags.length) form(w + " is tagged but has no text.", { row: r.id });
					il.tags.forEach((t) => {
						const i = tagInfo(d, t);
						if (!i.ok) form(w + " has a tag that no longer resolves: " + i.label + ".", { row: r.id });
					});
				});
			});
			coverage(d).forEach((c) => {
				if (!c.rows.length) advice("CLO " + c.n + " is not covered by any ILO yet.", { clo: c.id });
			});
			const ws = Object.keys(weekSet(d.plan)).length;
			if (ws < 18) advice("The plan covers " + ws + " of 18 weeks.");
		}
		if (key === "reqs") {
			if (d.reqs.filter((r) => r.t.trim()).length < 3) form("List at least 3 course requirements.");
		}
		if (key === "refs") GROUPS.forEach((g) => {
			const grp = d.refs[g[0]];
			if (!grp.na && !grp.items.some((x) => x.t.trim())) form(g[1] + " has no entries. Add one or mark it not applicable.");
		});
		if (key === "grade") {
			const t = gradeTotal(d);
			if (t !== 100) form("Components total " + t + "%, not 100%.");
			if (!d.grading.rows.length) form("Add grading components.");
			const ex = examRows(d).length;
			if (ex < 3) advice("Only " + ex + " of 3 grading terms have an exam row in the Learning Plan.");
			if (d.grading.override.on && (!d.grading.override.term.trim() || !d.grading.override.final.trim())) form("Override formulas cannot be empty.");
		}
		return o;
	}
	const blockers = (d, key) => issues(d, key).filter((i) => i.blocking);
	function stepStatuses(d, visited = {}, { sequential = false } = {}) {
		const st = STEPS.map((s, i) => {
			if (s.key === "review") return "todo";
			return blockers(d, s.key).length === 0 ? "done" : visited[i] ? "attn" : "todo";
		});
		const sixDone = st.slice(0, 6).every((x) => x === "done");
		st[6] = sixDone ? "done" : visited[6] ? "attn" : "todo";
		const firstBlocked = st.slice(0, 6).findIndex((status) => status !== "done");
		return {
			statuses: sequential && firstBlocked >= 0 ? st.map((status, index) => index > firstBlocked ? "locked" : status) : st,
			complete: sixDone,
			firstBlocked
		};
	}
	function firstBlocked(d) {
		for (let i = 0; i < 6; i++) if (blockers(d, STEPS[i].key).length) return i;
		return -1;
	}
	const outcomesReady = (d) => hasOutcomeSelection(d) && blockers(d, "clos").length === 0;
	return {
		institution,
		institutionFor,
		programs,
		year,
		outcomesReady,
		hasOutcomeSelection,
		poList,
		egaList,
		tagInfo,
		rowHits,
		coverage,
		removeClo,
		impliedEgas,
		missingEgas,
		formulas,
		refAge,
		suggestReqs,
		issues,
		blockers,
		firstBlocked,
		stepStatuses
	};
}
createModel({
	institution: INSTITUTION,
	programs: PROGRAMS,
	year: CURRENT_SCHOOL_YEAR.startYear
});
//#endregion
//#region src/lib/hybridCheck.js
const ADVISORY_RULES = /* @__PURE__ */ new Set([
	"AI-REQUIRED",
	"SEM",
	"LINK",
	"REF-PLAN"
]);
const hardGatesOf = (run) => (run?.findings || []).filter((f) => f.severity === "blocking" && !ADVISORY_RULES.has(f.ruleId));
function canSubmitHybrid(run, signature, gate = "required") {
	if (gate === "advisory") {
		if (!run || run.stale || signature && run.draftSignature !== signature) return true;
		return hardGatesOf(run).length === 0;
	}
	return !!(run?.hybrid?.ready && run.hybrid.alignment?.status === "completed" && !run.stale && (!signature || run.draftSignature === signature) && Date.now() - Date.parse(run.hybrid.checkedAt) <= 18e5);
}
const sameValue = (a, b) => {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
	if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
	const keys = Object.keys(a).sort(), other = Object.keys(b).sort();
	return keys.length === other.length && keys.every((key, i) => key === other[i] && sameValue(a[key], b[key]));
};
function applySuggestion(draft, patch, { requireOriginal = false } = {}) {
	if (!patch || !/^(meta\.(title|prereq|lecture|lab|yearLevel)|outcomes\.(vision|mission|egas|pos)|description|clos\[\d+\]\.statement|plan\[\d+\]\.(values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/.test(patch.path)) throw Error("This suggestion cannot be applied to the form.");
	if (requireOriginal && !Object.hasOwn(patch, "originalValue")) throw Error("hybrid.refreshSuggestions");
	const result = structuredClone(draft);
	const parts = patch.path.replace(/\[(\d+)\]/g, ".$1").split(".");
	let parent = result;
	for (const key of parts.slice(0, -1)) {
		if (!parent || !Object.prototype.hasOwnProperty.call(parent, key)) throw Error("The target field changed; run the checker again.");
		parent = parent[key];
	}
	const row = patch.path.match(/^(clos|plan)\[(\d+)\](?:\.ilos\[(\d+)\])?/);
	if (row) {
		const target = draft[row[1]]?.[Number(row[2])];
		if (patch.targetIds?.row !== void 0 && target?.id !== patch.targetIds.row || patch.targetIds?.ilo !== void 0 && target?.ilos?.[Number(row[3])]?.id !== patch.targetIds.ilo) throw Error("hybrid.suggestionTargetChanged");
	}
	const current = parent[parts.at(-1)];
	const original = patch.originalMissing ? void 0 : patch.originalValue;
	if (Object.hasOwn(patch, "originalValue") && !sameValue(current, original) && !sameValue(current, patch.replacement)) throw Error("hybrid.suggestionTargetChanged");
	parent[parts.at(-1)] = structuredClone(patch.replacement);
	return result;
}
async function undoSuggestion({ suggestion, appliedValue, applyDraft, recordDecision }) {
	if (!applyDraft || suggestion.originalMissing || !Object.hasOwn(suggestion, "originalValue")) throw Error("hybrid.cannotUndo");
	await applyDraft({
		...suggestion,
		originalValue: appliedValue,
		originalMissing: false,
		replacement: suggestion.originalValue
	});
	try {
		return await recordDecision({
			suggestionId: suggestion.id,
			action: "reject"
		});
	} catch (error) {
		error.draftSaved = true;
		throw error;
	}
}
async function decideSuggestion({ suggestion, action, editedText, applyDraft, recordDecision }) {
	let applied = false;
	if (action !== "reject" && applyDraft) {
		await applyDraft({
			...suggestion,
			replacement: action === "edit" ? editedText : suggestion.replacement
		});
		applied = true;
	}
	try {
		return {
			decision: await recordDecision({
				suggestionId: suggestion.id,
				action,
				editedText
			}),
			applied
		};
	} catch (error) {
		if (applied) error.draftSaved = true;
		throw error;
	}
}
//#endregion
//#region src/lib/syllabusRules.js
const RETURNED_STATUSES = ["for_revision", "rejected"];
const EDITABLE_STATUSES = ["draft", ...RETURNED_STATUSES];
const isReturned = (status) => RETURNED_STATUSES.includes(status);
const noteMissing = (status, note) => isReturned(status) && String(note || "").trim().length < 10;
const STATUS_LABELS = {
	draft: "Draft",
	submitted: "Submitted",
	under_review: "Under Review",
	for_revision: "For Revision",
	approved: "Approved",
	rejected: "Rejected"
};
const ARCHIVED_REASON = "This syllabus is archived because its subject was assigned to another faculty member. You can still read it.";
const editBlockedReason = (syllabus) => syllabus.archived ? ARCHIVED_REASON : EDITABLE_STATUSES.includes(syllabus.status) ? "" : syllabus.status === "submitted" || syllabus.status === "under_review" ? "This syllabus was submitted and is locked. You can edit it again only if the administrator sends it back." : `${STATUS_LABELS[syllabus.status] || syllabus.status} syllabi can't be edited`;
const NOTHING_ASSIGNED = "No program or subject is assigned to you yet. Ask an administrator.";
const NO_SUBJECT_YET = "A program is assigned to you, but no subject yet. Ask an administrator.";
function assignmentState(mine) {
	if (!mine || mine.unrestricted) return null;
	if (mine.courseIds.length) return "ok";
	return mine.programIds.length ? "noSubject" : "none";
}
const ASSIGNMENT_MESSAGES = {
	none: NOTHING_ASSIGNED,
	noSubject: NO_SUBJECT_YET
};
//#endregion
//#region src/views/builder2/parts.jsx
const PATHS = {
	up: "M8 13V3M4 7l4-4 4 4",
	down: "M8 3v10M4 9l4 4 4-4",
	copy: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
	x: "M4 4l8 8M12 4l-8 8",
	lock: "M4.5 7.5h7v5.5h-7zM6 7.5V5.5a2 2 0 014 0v2"
};
function Ic({ n }) {
	return /* @__PURE__ */ jsx("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.5",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", { d: PATHS[n] })
	});
}
const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function Auto({ value, onChange, className = "cell", placeholder = "", label, fid, onKeyDown }) {
	const ref = useRef(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = el.scrollHeight + "px";
	}, [value]);
	return /* @__PURE__ */ jsx("textarea", {
		ref,
		rows: "1",
		className,
		value,
		placeholder,
		"aria-label": label || placeholder || t$3("ui.text_c3328c"),
		"data-fid": fid,
		onChange: (e) => onChange(e.target.value),
		onKeyDown
	});
}
function Code({ info, size }) {
	return /* @__PURE__ */ jsx("span", {
		className: "code" + (size ? " " + size : "") + (info.kind === "clo" ? " k" + info.idx % 6 : " ref"),
		children: tr(info.label)
	});
}
function Tag({ info, onRemove }) {
	const tip = info.label + " – " + (info.text || info.name);
	return /* @__PURE__ */ jsxs("span", {
		className: "tagc" + (info.ok ? "" : " bad"),
		title: tip,
		children: [
			/* @__PURE__ */ jsx(Code, { info }),
			" ",
			/* @__PURE__ */ jsx("span", {
				className: "nm",
				children: info.name
			}),
			onRemove && /* @__PURE__ */ jsx("button", {
				type: "button",
				"aria-label": t$3("ui.remove_1680e3") + info.label,
				onClick: (e) => {
					e.stopPropagation();
					onRemove();
				},
				children: "×"
			})
		]
	});
}
function OutcomePicker({ model, d, kinds, rect, title, selected, onToggle, onClose }) {
	const ref = useRef(null);
	const [q, setQ] = useState("");
	useEffect(() => {
		const input = ref.current && ref.current.querySelector("input[type=\"search\"]");
		if (input) input.focus();
		const out = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		const key = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", out);
		document.addEventListener("keydown", key);
		window.addEventListener("resize", onClose);
		return () => {
			document.removeEventListener("mousedown", out);
			document.removeEventListener("keydown", key);
			window.removeEventListener("resize", onClose);
		};
	}, []);
	const ql = q.trim().toLowerCase();
	const mk = (tag) => ({
		tag,
		info: model.tagInfo(d, tag)
	});
	const pos = model.poList(d);
	const groups = [];
	if (kinds.includes("clo")) groups.push({
		kind: "clo",
		title: "Course learning outcomes",
		items: d.clos.map((c) => mk("clo:" + c.id))
	});
	if (kinds.includes("ega")) groups.push({
		kind: "ega",
		title: "Expected graduate attributes",
		items: model.egaList(d).map((e) => mk("ega:" + e.no))
	});
	if (kinds.includes("po")) groups.push({
		kind: "po",
		title: "Program outcomes · " + d.meta.program,
		items: pos.map((o) => mk("po:" + o.no))
	});
	groups.forEach((g) => {
		g.items = g.items.filter((it) => !ql || (it.info.label + " " + it.info.name + " " + it.info.text).toLowerCase().includes(ql));
	});
	const h = Math.min(380, window.innerHeight - 24);
	const top = rect.bottom + 6;
	const style = {
		left: Math.max(8, Math.min(rect.left, window.innerWidth - 388)),
		width: 380,
		maxHeight: h
	};
	if (top + h > window.innerHeight) style.bottom = Math.max(8, window.innerHeight - rect.top + 6);
	else style.top = top;
	const any = groups.some((g) => g.items.length);
	return /* @__PURE__ */ jsxs("div", {
		className: "bld2-pop",
		ref,
		style,
		role: "dialog",
		"aria-label": title || t$3("ui.tag_outcomes_9af691"),
		children: [
			/* @__PURE__ */ jsx("input", {
				type: "search",
				className: "in",
				value: q,
				placeholder: t$3("ui.search_by_name_or_number_63632c"),
				"aria-label": t$3("ui.search_outcomes_3d2fd6"),
				onChange: (e) => setQ(e.target.value)
			}),
			groups.filter((g) => !ql || g.items.length).map((g) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h4", { children: tr(g.title) }), g.items.length ? g.items.map((it) => /* @__PURE__ */ jsxs("label", {
				className: "opt",
				children: [
					/* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: selected.includes(it.tag),
						onChange: () => onToggle(it.tag)
					}),
					/* @__PURE__ */ jsx(Code, { info: it.info }),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
						className: "on",
						children: it.info.name
					}), it.info.text && it.info.text !== it.info.name && /* @__PURE__ */ jsx("span", {
						className: "ot",
						children: it.info.text
					})] })
				]
			}, it.tag)) : /* @__PURE__ */ jsx("div", {
				className: "none",
				children: g.kind === "po" && !pos.length ? t$3("ui.no_program_outcomes_loaded_for_23e032") + (d.meta.program || tr("this program")) + "." : g.kind === "clo" && !d.clos.length ? tr("No CLOs yet. Add them in step 2.") : tr("No match.")
			})] }, g.kind)),
			!any && q && /* @__PURE__ */ jsxs("div", {
				className: "none",
				children: [
					t$3("ui.nothing_matches_019f8e"),
					"“",
					q,
					"”",
					"."
				]
			})
		]
	});
}
function CoverageStrip({ model, d, filter, onPick }) {
	const cov = model.coverage(d);
	if (!cov.length) return null;
	return /* @__PURE__ */ jsx("div", {
		className: "cov",
		role: "group",
		"aria-label": t$3("ui.clo_coverage_98ba99"),
		children: cov.map((c, i) => {
			const clo = d.clos[i];
			const on = filter === c.id;
			const ws = {};
			c.weeks.forEach((w) => {
				ws[w] = 1;
			});
			return /* @__PURE__ */ jsxs("button", {
				type: "button",
				className: "cv" + (on ? " on" : ""),
				"aria-pressed": on,
				onClick: () => onPick(c.id),
				children: [
					/* @__PURE__ */ jsxs("span", {
						className: "t",
						children: [/* @__PURE__ */ jsx("span", {
							className: "code k" + i % 6,
							children: t$3("ui.clo_069efc") + (i + 1)
						}), /* @__PURE__ */ jsx("span", {
							className: "ti",
							children: clo.title || t$3("ui.untitled_621521")
						})]
					}),
					/* @__PURE__ */ jsx("span", {
						className: "w" + (c.rows.length ? "" : " none"),
						children: c.rows.length ? tr(c.weeks.length + (c.weeks.length === 1 ? " week" : " weeks") + " · " + c.rows.length + (c.rows.length === 1 ? " row" : " rows")) : t$3("ui.not_covered_yet_3a7d66")
					}),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
						className: "ruler",
						"aria-hidden": "true",
						children: Array.from({ length: 18 }, (_, k) => /* @__PURE__ */ jsx("i", { className: ws[k + 1] ? "k" + i % 6 : "" }, k + 1))
					}), /* @__PURE__ */ jsxs("span", {
						className: "rulerlbl",
						"aria-hidden": "true",
						children: [/* @__PURE__ */ jsx("span", { children: t$3("ui.wk_1_474a85") }), /* @__PURE__ */ jsx("span", { children: "18" })]
					})] })
				]
			}, c.id);
		})
	});
}
//#endregion
//#region src/lib/phTime.js
const PH_TZ = "Asia/Manila";
const PH_OFFSET = "+08:00";
function toDate(value) {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (value === null || value === void 0 || value === "") return null;
	const s = String(value).trim();
	const bare = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(s);
	const d = new Date(bare ? bare[1] + "T" + bare[2] + PH_OFFSET : s);
	return Number.isNaN(d.getTime()) ? null : d;
}
const formatter = (opts) => new Intl.DateTimeFormat(getLocale(), {
	timeZone: PH_TZ,
	...opts
});
const clean$1 = (text) => text.replace(/[  ]/g, " ");
function phDate(value) {
	const d = toDate(value);
	return d ? clean$1(formatter({
		month: "short",
		day: "numeric",
		year: "numeric"
	}).format(d)) : "";
}
function phTime(value) {
	const d = toDate(value);
	return d ? clean$1(formatter({
		hour: "numeric",
		minute: "2-digit",
		hour12: true
	}).format(d)) : "";
}
//#endregion
//#region src/lib/draftSave.js
const hasSubject = (d) => !!(d && d.meta && d.meta.courseId);
async function saveOnce({ api, d, idRef, saved, sections, schemaVersion }) {
	const changed = sections.filter((k) => d[k] !== void 0 && JSON.stringify(d[k]) !== saved.current[k]);
	if (!changed.length) return "unchanged";
	if (!idRef.current && !hasSubject(d)) return "no-subject";
	let created = false;
	if (!idRef.current) {
		idRef.current = (await api.createDraft()).id;
		created = true;
	}
	const body = {};
	const sent = {};
	changed.forEach((k) => {
		body[k] = d[k];
		sent[k] = JSON.stringify(d[k]);
	});
	try {
		await api.saveContent(idRef.current, body, schemaVersion);
	} catch (e) {
		if (created && e && e.data && e.data.code === "syllabus_exists") {
			const id = idRef.current;
			idRef.current = null;
			await api.remove(id).catch(() => {});
		}
		throw e;
	}
	Object.assign(saved.current, sent);
	return "saved";
}
//#endregion
//#region src/views/builder2/useDraft.js
const newId = () => "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const SECTIONS = [
	"meta",
	"outcomes",
	"description",
	"clos",
	"plan",
	"reqs",
	"refs",
	"grading"
];
const DEBOUNCE_MS = 800;
function reducer(state, a) {
	if (a.type === "PATCH") return a.fn(clone(state));
	if (a.type === "SET") return a.v;
	return state;
}
const stamp = () => phTime(/* @__PURE__ */ new Date());
function useDraft(editing) {
	const [draft, dispatch] = useReducer(reducer, null);
	const [load, setLoad] = useState({
		loading: true,
		error: "",
		editable: true,
		status: "draft",
		version: "v1.0"
	});
	const [save, setSave] = useState({
		state: "saved",
		time: ""
	});
	const idRef = useRef(editing && editing.syllabusId ? editing.syllabusId : null);
	const latest = useRef(null);
	const savedJson = useRef({});
	const touched = useRef(false);
	const timer = useRef(null);
	const running = useRef(false);
	const again = useRef(false);
	const pending = useRef(false);
	useEffect(() => {
		let live = true;
		(async () => {
			try {
				let content = null;
				let adoptedOutcomes = false;
				let info = {
					editable: true,
					status: "draft",
					version: "v1.0"
				};
				if (idRef.current) {
					const r = await syllabi.getContent(idRef.current);
					content = r.content;
					adoptedOutcomes = r.adoptedOutcomes;
					info = {
						editable: r.editable,
						status: r.status,
						version: r.version,
						lockedReason: r.lockedReason || "",
						nextVersion: r.nextVersion || "",
						reviewerNote: r.reviewerNote || ""
					};
				}
				let d;
				if (content) {
					d = hydrateContent(content, newId);
					SECTIONS.forEach((k) => {
						if (content[k] !== void 0 && !(adoptedOutcomes && ["outcomes", "clos"].includes(k))) savedJson.current[k] = JSON.stringify(d[k]);
					});
				} else {
					d = emptyDraft(newId);
					if (editing) {
						d.meta.code = editing.code || "";
						d.meta.title = editing.title || "";
					}
				}
				if (!live) return;
				latest.current = d;
				dispatch({
					type: "SET",
					v: d
				});
				setLoad({
					loading: false,
					error: "",
					...info
				});
			} catch (e) {
				if (live) setLoad({
					loading: false,
					error: e.message,
					editable: false,
					status: "draft",
					version: ""
				});
			}
		})();
		return () => {
			live = false;
		};
	}, []);
	const inflight = useRef(null);
	const flush = useCallback(() => {
		if (running.current) {
			again.current = true;
			return inflight.current;
		}
		running.current = true;
		inflight.current = (async () => {
			try {
				do {
					again.current = false;
					const d = latest.current;
					if (!d || !touched.current) break;
					setSave((s) => ({
						...s,
						state: "saving"
					}));
					if (await saveOnce({
						api: syllabi,
						d,
						idRef,
						saved: savedJson,
						sections: SECTIONS,
						schemaVersion: 3
					}) !== "saved") {
						pending.current = false;
						setSave((x) => x.state === "pending" || x.state === "saving" ? {
							...x,
							state: "saved"
						} : x);
						break;
					}
					setSave({
						state: "saved",
						time: stamp()
					});
					if (!again.current) pending.current = SECTIONS.some((k) => JSON.stringify(latest.current[k]) !== savedJson.current[k]);
				} while (again.current);
				return true;
			} catch (e) {
				setSave((s) => ({
					...s,
					state: "error",
					message: e.message,
					code: e.data && e.data.code
				}));
				return false;
			} finally {
				running.current = false;
			}
		})();
		return inflight.current;
	}, []);
	useEffect(() => {
		if (!draft) return void 0;
		latest.current = draft;
		if (!touched.current) return void 0;
		pending.current = true;
		setSave((s) => s.state === "saved" || s.state === "error" ? {
			...s,
			state: "pending"
		} : s);
		clearTimeout(timer.current);
		timer.current = setTimeout(flush, DEBOUNCE_MS);
		return () => clearTimeout(timer.current);
	}, [draft, flush]);
	useEffect(() => () => {
		clearTimeout(timer.current);
		if (touched.current) flush();
	}, [flush]);
	useEffect(() => {
		const warn = (e) => {
			if (pending.current) {
				flush();
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [flush]);
	return {
		draft,
		apply: useCallback((fn) => {
			touched.current = true;
			dispatch({
				type: "PATCH",
				fn
			});
		}, []),
		set: useCallback((v) => {
			touched.current = true;
			dispatch({
				type: "SET",
				v
			});
		}, []),
		setAndSave: useCallback((v) => {
			touched.current = true;
			latest.current = v;
			pending.current = true;
			dispatch({
				type: "SET",
				v
			});
			clearTimeout(timer.current);
			return flush();
		}, [flush]),
		save,
		saveNow: useCallback(() => {
			clearTimeout(timer.current);
			return flush();
		}, [flush]),
		load,
		syllabusId: () => idRef.current
	};
}
//#endregion
//#region node_modules/react-dom/cjs/react-dom.production.js
/**
* @license React
* react-dom.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_dom_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = __require("react");
	function formatProdErrorMessage(code) {
		var url = "https://react.dev/errors/" + code;
		if (1 < arguments.length) {
			url += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var i = 2; i < arguments.length; i++) url += "&args[]=" + encodeURIComponent(arguments[i]);
		}
		return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function noop() {}
	var Internals = {
		d: {
			f: noop,
			r: function() {
				throw Error(formatProdErrorMessage(522));
			},
			D: noop,
			C: noop,
			L: noop,
			m: noop,
			X: noop,
			S: noop,
			M: noop
		},
		p: 0,
		findDOMNode: null
	};
	var REACT_PORTAL_TYPE = Symbol.for("react.portal");
	var REACT_RECOVERABLE_TYPE = Symbol.for("react.recoverable");
	var REACT_OPTIMISTIC_KEY = Symbol.for("react.optimistic_key");
	function createPortal$1(children, containerInfo, implementation) {
		var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
		return {
			$$typeof: REACT_PORTAL_TYPE,
			key: null == key ? null : key === REACT_OPTIMISTIC_KEY ? REACT_OPTIMISTIC_KEY : "" + key,
			children,
			containerInfo,
			implementation
		};
	}
	var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function getCrossOriginStringAs(as, input) {
		if ("font" === as) return "";
		if ("string" === typeof input) return "use-credentials" === input ? input : "";
	}
	exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
	exports.browser = function(reason) {
		return {
			$$typeof: REACT_RECOVERABLE_TYPE,
			_reason: reason
		};
	};
	exports.createPortal = function(children, container) {
		var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
		if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType) throw Error(formatProdErrorMessage(299));
		return createPortal$1(children, container, null, key);
	};
	exports.flushSync = function(fn) {
		var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
		try {
			if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
		} finally {
			ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
		}
	};
	exports.preconnect = function(href, options) {
		"string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
	};
	exports.prefetchDNS = function(href) {
		"string" === typeof href && Internals.d.D(href);
	};
	exports.preinit = function(href, options) {
		if ("string" === typeof href && options && "string" === typeof options.as) {
			var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
			"style" === as ? Internals.d.S(href, "string" === typeof options.precedence ? options.precedence : void 0, {
				crossOrigin,
				integrity,
				fetchPriority
			}) : "script" === as && Internals.d.X(href, {
				crossOrigin,
				integrity,
				fetchPriority,
				nonce: "string" === typeof options.nonce ? options.nonce : void 0
			});
		}
	};
	exports.preinitModule = function(href, options) {
		if ("string" === typeof href) if ("object" === typeof options && null !== options) {
			if (null == options.as || "script" === options.as) {
				var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
				Internals.d.M(href, {
					crossOrigin,
					integrity: "string" === typeof options.integrity ? options.integrity : void 0,
					nonce: "string" === typeof options.nonce ? options.nonce : void 0,
					fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
				});
			}
		} else options ?? Internals.d.M(href);
	};
	exports.preload = function(href, options) {
		if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
			var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
			Internals.d.L(href, as, {
				crossOrigin,
				integrity: "string" === typeof options.integrity ? options.integrity : void 0,
				nonce: "string" === typeof options.nonce ? options.nonce : void 0,
				type: "string" === typeof options.type ? options.type : void 0,
				fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
				referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
				imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
				imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
				media: "string" === typeof options.media ? options.media : void 0
			});
		}
	};
	exports.preloadModule = function(href, options) {
		if ("string" === typeof href) if (options) {
			var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
			Internals.d.m(href, {
				as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
				crossOrigin,
				integrity: "string" === typeof options.integrity ? options.integrity : void 0,
				nonce: "string" === typeof options.nonce ? options.nonce : void 0,
				fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
			});
		} else Internals.d.m(href);
	};
	exports.requestFormReset = function(form) {
		Internals.d.r(form);
	};
	exports.unstable_batchedUpdates = function(fn, a) {
		return fn(a);
	};
	exports.useFormState = function(action, initialState, permalink) {
		return ReactSharedInternals.H.useFormState(action, initialState, permalink);
	};
	exports.useFormStatus = function() {
		return ReactSharedInternals.H.useHostTransitionStatus();
	};
	exports.version = "19.3.0";
}));
//#endregion
//#region node_modules/react-dom/cjs/react-dom.development.js
/**
* @license React
* react-dom.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_dom_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	"production" !== process.env.NODE_ENV && (function() {
		function noop() {}
		function testStringCoercion(value) {
			return "" + value;
		}
		function createPortal$1(children, containerInfo, implementation) {
			var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
			if (null == key) key = null;
			else if (key === REACT_OPTIMISTIC_KEY) key = REACT_OPTIMISTIC_KEY;
			else {
				try {
					testStringCoercion(key);
					var JSCompiler_inline_result = !1;
				} catch (e) {
					JSCompiler_inline_result = !0;
				}
				JSCompiler_inline_result && (console.error("The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", "function" === typeof Symbol && Symbol.toStringTag && key[Symbol.toStringTag] || key.constructor.name || "Object"), testStringCoercion(key));
				key = "" + key;
			}
			return {
				$$typeof: REACT_PORTAL_TYPE,
				key,
				children,
				containerInfo,
				implementation
			};
		}
		function getCrossOriginStringAs(as, input) {
			if ("font" === as) return "";
			if ("string" === typeof input) return "use-credentials" === input ? input : "";
		}
		function getValueDescriptorExpectingObjectForWarning(thing) {
			return null === thing ? "`null`" : void 0 === thing ? "`undefined`" : "" === thing ? "an empty string" : "something with type \"" + typeof thing + "\"";
		}
		function getValueDescriptorExpectingEnumForWarning(thing) {
			return null === thing ? "`null`" : void 0 === thing ? "`undefined`" : "" === thing ? "an empty string" : "string" === typeof thing ? JSON.stringify(thing) : "number" === typeof thing ? "`" + thing + "`" : "something with type \"" + typeof thing + "\"";
		}
		function resolveDispatcher() {
			var dispatcher = ReactSharedInternals.H;
			null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var React = __require("react"), Internals = {
			d: {
				f: noop,
				r: function() {
					throw Error("Invalid form element. requestFormReset must be passed a form that was rendered by React.");
				},
				D: noop,
				C: noop,
				L: noop,
				m: noop,
				X: noop,
				S: noop,
				M: noop
			},
			p: 0,
			findDOMNode: null
		}, REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_RECOVERABLE_TYPE = Symbol.for("react.recoverable"), REACT_OPTIMISTIC_KEY = Symbol.for("react.optimistic_key"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
		"function" === typeof Map && null != Map.prototype && "function" === typeof Map.prototype.forEach && "function" === typeof Set && null != Set.prototype && "function" === typeof Set.prototype.clear && "function" === typeof Set.prototype.forEach || console.error("React depends on Map and Set built-in types. Make sure that you load a polyfill in older browsers. https://reactjs.org/link/react-polyfills");
		exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
		exports.browser = function(reason) {
			return {
				$$typeof: REACT_RECOVERABLE_TYPE,
				_reason: reason
			};
		};
		exports.createPortal = function(children, container) {
			var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
			if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType) throw Error("Target container is not a DOM element.");
			return createPortal$1(children, container, null, key);
		};
		exports.flushSync = function(fn) {
			var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
			try {
				if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
			} finally {
				ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f() && console.error("flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task.");
			}
		};
		exports.preconnect = function(href, options) {
			"string" === typeof href && href ? null != options && "object" !== typeof options ? console.error("ReactDOM.preconnect(): Expected the `options` argument (second) to be an object but encountered %s instead. The only supported option at this time is `crossOrigin` which accepts a string.", getValueDescriptorExpectingEnumForWarning(options)) : null != options && "string" !== typeof options.crossOrigin && console.error("ReactDOM.preconnect(): Expected the `crossOrigin` option (second argument) to be a string but encountered %s instead. Try removing this option or passing a string value instead.", getValueDescriptorExpectingObjectForWarning(options.crossOrigin)) : console.error("ReactDOM.preconnect(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
			"string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
		};
		exports.prefetchDNS = function(href) {
			if ("string" !== typeof href || !href) console.error("ReactDOM.prefetchDNS(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
			else if (1 < arguments.length) {
				var options = arguments[1];
				"object" === typeof options && options.hasOwnProperty("crossOrigin") ? console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. It looks like the you are attempting to set a crossOrigin property for this DNS lookup hint. Browsers do not perform DNS queries using CORS and setting this attribute on the resource hint has no effect. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", getValueDescriptorExpectingEnumForWarning(options)) : console.error("ReactDOM.prefetchDNS(): Expected only one argument, `href`, but encountered %s as a second argument instead. This argument is reserved for future options and is currently disallowed. Try calling ReactDOM.prefetchDNS() with just a single string argument, `href`.", getValueDescriptorExpectingEnumForWarning(options));
			}
			"string" === typeof href && Internals.d.D(href);
		};
		exports.preinit = function(href, options) {
			"string" === typeof href && href ? null == options || "object" !== typeof options ? console.error("ReactDOM.preinit(): Expected the `options` argument (second) to be an object with an `as` property describing the type of resource to be preinitialized but encountered %s instead.", getValueDescriptorExpectingEnumForWarning(options)) : "style" !== options.as && "script" !== options.as && console.error("ReactDOM.preinit(): Expected the `as` property in the `options` argument (second) to contain a valid value describing the type of resource to be preinitialized but encountered %s instead. Valid values for `as` are \"style\" and \"script\".", getValueDescriptorExpectingEnumForWarning(options.as)) : console.error("ReactDOM.preinit(): Expected the `href` argument (first) to be a non-empty string but encountered %s instead.", getValueDescriptorExpectingObjectForWarning(href));
			if ("string" === typeof href && options && "string" === typeof options.as) {
				var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
				"style" === as ? Internals.d.S(href, "string" === typeof options.precedence ? options.precedence : void 0, {
					crossOrigin,
					integrity,
					fetchPriority
				}) : "script" === as && Internals.d.X(href, {
					crossOrigin,
					integrity,
					fetchPriority,
					nonce: "string" === typeof options.nonce ? options.nonce : void 0
				});
			}
		};
		exports.preinitModule = function(href, options) {
			var encountered = "";
			"string" === typeof href && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
			void 0 !== options && "object" !== typeof options ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : options && "as" in options && "script" !== options.as && (encountered += " The `as` option encountered was " + getValueDescriptorExpectingEnumForWarning(options.as) + ".");
			if (encountered) console.error("ReactDOM.preinitModule(): Expected up to two arguments, a non-empty `href` string and, optionally, an `options` object with a valid `as` property.%s", encountered);
			else switch (encountered = options && "string" === typeof options.as ? options.as : "script", encountered) {
				case "script": break;
				default: encountered = getValueDescriptorExpectingEnumForWarning(encountered), console.error("ReactDOM.preinitModule(): Currently the only supported \"as\" type for this function is \"script\" but received \"%s\" instead. This warning was generated for `href` \"%s\". In the future other module types will be supported, aligning with the import-attributes proposal. Learn more here: (https://github.com/tc39/proposal-import-attributes)", encountered, href);
			}
			if ("string" === typeof href) if ("object" === typeof options && null !== options) {
				if (null == options.as || "script" === options.as) encountered = getCrossOriginStringAs(options.as, options.crossOrigin), Internals.d.M(href, {
					crossOrigin: encountered,
					integrity: "string" === typeof options.integrity ? options.integrity : void 0,
					nonce: "string" === typeof options.nonce ? options.nonce : void 0,
					fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
				});
			} else options ?? Internals.d.M(href);
		};
		exports.preload = function(href, options) {
			var encountered = "";
			"string" === typeof href && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
			null == options || "object" !== typeof options ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : "string" === typeof options.as && options.as || (encountered += " The `as` option encountered was " + getValueDescriptorExpectingObjectForWarning(options.as) + ".");
			encountered && console.error("ReactDOM.preload(): Expected two arguments, a non-empty `href` string and an `options` object with an `as` property valid for a `<link rel=\"preload\" as=\"...\" />` tag.%s", encountered);
			if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
				encountered = options.as;
				var crossOrigin = getCrossOriginStringAs(encountered, options.crossOrigin);
				Internals.d.L(href, encountered, {
					crossOrigin,
					integrity: "string" === typeof options.integrity ? options.integrity : void 0,
					nonce: "string" === typeof options.nonce ? options.nonce : void 0,
					type: "string" === typeof options.type ? options.type : void 0,
					fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
					referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
					imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
					imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
					media: "string" === typeof options.media ? options.media : void 0
				});
			}
		};
		exports.preloadModule = function(href, options) {
			var encountered = "";
			"string" === typeof href && href || (encountered += " The `href` argument encountered was " + getValueDescriptorExpectingObjectForWarning(href) + ".");
			void 0 !== options && "object" !== typeof options ? encountered += " The `options` argument encountered was " + getValueDescriptorExpectingObjectForWarning(options) + "." : options && "as" in options && "string" !== typeof options.as && (encountered += " The `as` option encountered was " + getValueDescriptorExpectingObjectForWarning(options.as) + ".");
			encountered && console.error("ReactDOM.preloadModule(): Expected two arguments, a non-empty `href` string and, optionally, an `options` object with an `as` property valid for a `<link rel=\"modulepreload\" as=\"...\" />` tag.%s", encountered);
			"string" === typeof href && (options ? (encountered = getCrossOriginStringAs(options.as, options.crossOrigin), Internals.d.m(href, {
				as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
				crossOrigin: encountered,
				integrity: "string" === typeof options.integrity ? options.integrity : void 0,
				nonce: "string" === typeof options.nonce ? options.nonce : void 0,
				fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0
			})) : Internals.d.m(href));
		};
		exports.requestFormReset = function(form) {
			Internals.d.r(form);
		};
		exports.unstable_batchedUpdates = function(fn, a) {
			return fn(a);
		};
		exports.useFormState = function(action, initialState, permalink) {
			return resolveDispatcher().useFormState(action, initialState, permalink);
		};
		exports.useFormStatus = function() {
			return resolveDispatcher().useHostTransitionStatus();
		};
		exports.version = "19.3.0";
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
}));
//#endregion
//#region src/lib/selectModel.js
var import_react_dom = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	function checkDCE() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") return;
		if (process.env.NODE_ENV !== "production") throw new Error("^_^");
		try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
		} catch (err) {
			console.error(err);
		}
	}
	if (process.env.NODE_ENV === "production") {
		checkDCE();
		module.exports = require_react_dom_production();
	} else module.exports = require_react_dom_development();
})))();
const enabled = (item) => !!item && !item.disabled;
const lower = (text) => String(text || "").toLowerCase();
const firstEnabled = (items) => items.findIndex(enabled);
const lastEnabled = (items) => {
	for (let i = items.length - 1; i >= 0; i--) if (enabled(items[i])) return i;
	return -1;
};
function moveActive(items, position, key) {
	if (!items.some(enabled)) return -1;
	if (key === "Home") return firstEnabled(items);
	if (key === "End") return lastEnabled(items);
	const step = key === "ArrowUp" ? -1 : key === "PageUp" ? -8 : key === "PageDown" ? 8 : 1;
	const direction = step < 0 ? -1 : 1;
	let at = position < 0 ? direction > 0 ? -1 : items.length : position;
	let target = Math.min(items.length - 1, Math.max(0, at + step));
	if (Math.abs(step) === 1 && (at + step < 0 || at + step > items.length - 1)) return position < 0 ? firstEnabled(items) : position;
	while (target >= 0 && target < items.length && !enabled(items[target])) target += direction;
	if (target < 0 || target >= items.length) return position >= 0 && enabled(items[position]) ? position : direction > 0 ? lastEnabled(items) : firstEnabled(items);
	return target;
}
function jumpIndex(items, position, query) {
	const q = lower(query);
	if (!q) return position;
	const starts = (item) => enabled(item) && lower(item.label).startsWith(q);
	const sameLetter = q.length > 1 && [...q].every((c) => c === q[0]);
	const word = sameLetter ? q[0] : q;
	const at = (item) => enabled(item) && lower(item.label).startsWith(word);
	const from = sameLetter || q.length === 1 ? position + 1 : 0;
	for (let n = 0; n < items.length; n++) {
		const i = (from + n) % items.length;
		if ((sameLetter || q.length === 1 ? at : starts)(items[i])) return i;
	}
	return position;
}
function filterItems(items, query) {
	const q = lower(query).trim();
	const all = items.map((item, index) => ({
		...item,
		index
	}));
	return q ? all.filter((item) => lower(item.label).includes(q)) : all;
}
function nextQuery(query, key, { now = 0, lastAt = 0 } = {}) {
	if (key === "Backspace") return query.slice(0, -1);
	if (!(typeof key === "string" && key.length === 1)) return query;
	return (now - lastAt > 700 ? "" : query) + key;
}
//#endregion
//#region src/components/Select.jsx
const MAX_PANEL = 280;
const GAP = 4;
const EDGE = 8;
function textOf(node) {
	if (node === null || node === void 0 || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	return isValidElement(node) ? textOf(node.props.children) : "";
}
function readOptions(children) {
	const out = [];
	const walk = (nodes) => Children.forEach(nodes, (child) => {
		if (!isValidElement(child)) return;
		if (child.type === Fragment) return walk(child.props.children);
		if (child.type === "optgroup") return walk(child.props.children);
		if (child.type !== "option") return;
		const label = textOf(child.props.children);
		out.push({
			value: String(child.props.value ?? label),
			label,
			disabled: !!child.props.disabled,
			lang: child.props.lang
		});
	});
	walk(children);
	return out;
}
const subscribeCoarse = (listener) => {
	const query = window.matchMedia("(pointer: coarse)");
	query.addEventListener("change", listener);
	return () => query.removeEventListener("change", listener);
};
const isCoarse = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
function Select({ value, defaultValue, onChange, disabled = false, id, className = "", name, children, ...rest }) {
	const uid = useId();
	const triggerRef = useRef(null);
	const panelRef = useRef(null);
	const typedAt = useRef(0);
	const buffer = useRef("");
	const items = readOptions(children);
	const controlled = value !== void 0;
	const [inner, setInner] = useState(defaultValue !== void 0 ? String(defaultValue) : items[0] ? items[0].value : "");
	const current = controlled ? String(value ?? "") : inner;
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(-1);
	const [place, setPlace] = useState(null);
	const coarse = useSyncExternalStore(typeof window !== "undefined" && window.matchMedia ? subscribeCoarse : () => () => {}, isCoarse, () => false);
	const filtering = items.length > 10;
	const shown = filtering ? filterItems(items, query) : items.map((item, index) => ({
		...item,
		index
	}));
	const selectedIndex = items.findIndex((item) => item.value === current);
	const label = selectedIndex >= 0 ? items[selectedIndex].label : "";
	const listId = uid + "-list";
	const optionId = (position) => uid + "-o-" + position;
	const close = () => {
		setOpen(false);
		setQuery("");
	};
	const openList = (seed = "") => {
		if (disabled) return;
		const at = shown.findIndex((item) => item.index === selectedIndex && !item.disabled);
		setActive(at >= 0 ? at : moveActive(shown, -1, "ArrowDown"));
		setQuery(seed);
		setOpen(true);
	};
	const choose = (item) => {
		if (!item || item.disabled) return;
		if (!controlled) setInner(item.value);
		if (onChange) onChange({
			target: {
				value: item.value,
				name
			},
			currentTarget: {
				value: item.value,
				name
			}
		});
		close();
	};
	useLayoutEffect(() => {
		if (!open || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const below = window.innerHeight - rect.bottom - EDGE - GAP;
		const above = rect.top - EDGE - GAP;
		const down = below >= Math.min(MAX_PANEL, 160) || below >= above;
		setPlace({
			left: rect.left,
			minWidth: rect.width,
			maxWidth: Math.max(rect.width, window.innerWidth - rect.left - EDGE),
			maxHeight: Math.max(96, Math.min(MAX_PANEL, down ? below : above)),
			...down ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }
		});
	}, [open]);
	useEffect(() => {
		if (!open) return void 0;
		const outside = (e) => {
			if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close();
		};
		const away = (e) => {
			if (!panelRef.current?.contains(e.target)) close();
		};
		document.addEventListener("pointerdown", outside, true);
		document.addEventListener("scroll", away, true);
		window.addEventListener("resize", close);
		return () => {
			document.removeEventListener("pointerdown", outside, true);
			document.removeEventListener("scroll", away, true);
			window.removeEventListener("resize", close);
		};
	}, [open]);
	useEffect(() => {
		if (open && panelRef.current) {
			const el = panelRef.current.querySelector("[data-active=\"true\"]");
			if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
		}
	}, [
		open,
		active,
		query
	]);
	const onKeyDown = (e) => {
		if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
		const key = e.key;
		const printable = key.length === 1 && !(key === " " && !query);
		if (!open) {
			if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
				e.preventDefault();
				openList();
			} else if (printable) {
				e.preventDefault();
				if (filtering) {
					typedAt.current = Date.now();
					openList(key);
					return;
				}
				const now = Date.now();
				buffer.current = nextQuery(buffer.current, key, {
					now,
					lastAt: typedAt.current
				});
				typedAt.current = now;
				const to = jumpIndex(items, selectedIndex, buffer.current);
				if (to >= 0 && to !== selectedIndex) choose(items[to]);
			}
			return;
		}
		if (key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			if (query) setQuery("");
			else close();
			return;
		}
		if (key === "Tab") {
			close();
			return;
		}
		if (key === "Enter" || key === " " && !query) {
			e.preventDefault();
			choose(shown[active]);
			return;
		}
		if ([
			"ArrowDown",
			"ArrowUp",
			"Home",
			"End",
			"PageDown",
			"PageUp"
		].includes(key)) {
			e.preventDefault();
			setActive(moveActive(shown, active, key));
			return;
		}
		if (key === "Backspace" || printable) {
			e.preventDefault();
			const now = Date.now();
			const q = nextQuery(query, key, {
				now,
				lastAt: typedAt.current
			});
			typedAt.current = now;
			setQuery(q);
			if (filtering) setActive(moveActive(filterItems(items, q), -1, "ArrowDown"));
			else {
				const to = jumpIndex(shown, active, q);
				if (to >= 0) setActive(to);
			}
		}
	};
	if (coarse) return /* @__PURE__ */ jsx("select", {
		value: controlled ? value : void 0,
		defaultValue: controlled ? void 0 : defaultValue,
		onChange,
		disabled,
		id,
		className,
		name,
		...rest,
		children
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "select",
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				id,
				ref: triggerRef,
				role: "combobox",
				disabled,
				className: "select-trigger " + className,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				"aria-controls": open ? listId : void 0,
				"aria-activedescendant": open && active >= 0 ? optionId(active) : void 0,
				onClick: () => open ? close() : openList(),
				onKeyDown,
				...rest,
				children: [/* @__PURE__ */ jsxs("span", {
					className: "select-value",
					children: [/* @__PURE__ */ jsx("span", {
						className: "select-current",
						lang: selectedIndex >= 0 ? items[selectedIndex].lang : void 0,
						children: label
					}), /* @__PURE__ */ jsx("span", {
						className: "select-sizer",
						"aria-hidden": "true",
						children: items.map((item) => /* @__PURE__ */ jsx("span", {
							"data-value": item.value,
							lang: item.lang,
							children: item.label
						}, item.value))
					})]
				}), /* @__PURE__ */ jsx("svg", {
					className: "select-chevron",
					viewBox: "0 0 16 16",
					width: "16",
					height: "16",
					"aria-hidden": "true",
					focusable: "false",
					children: /* @__PURE__ */ jsx("path", {
						d: "M4 6l4 4 4-4",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.6",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})]
			}),
			name && /* @__PURE__ */ jsx("input", {
				type: "hidden",
				name,
				value: current
			}),
			open && place && (0, import_react_dom.createPortal)(/* @__PURE__ */ jsxs("div", {
				className: "select-panel",
				ref: panelRef,
				style: place,
				children: [filtering && /* @__PURE__ */ jsx("div", {
					className: "select-hint",
					"aria-hidden": "true",
					children: query ? t$3("select.filtering", { query }) : t$3("select.typeToFilter")
				}), /* @__PURE__ */ jsxs("ul", {
					role: "listbox",
					id: listId,
					className: "select-list",
					"aria-label": rest["aria-label"],
					children: [shown.map((item, position) => /* @__PURE__ */ jsxs("li", {
						id: optionId(position),
						lang: item.lang,
						role: "option",
						"aria-selected": item.index === selectedIndex,
						"aria-disabled": item.disabled || void 0,
						"data-active": position === active,
						className: "select-option" + (item.index === selectedIndex ? " is-selected" : "") + (item.disabled ? " is-disabled" : ""),
						onMouseDown: (e) => e.preventDefault(),
						onMouseMove: () => {
							if (!item.disabled && active !== position) setActive(position);
						},
						onClick: () => choose(item),
						children: [/* @__PURE__ */ jsx("span", { children: item.label }), item.index === selectedIndex && /* @__PURE__ */ jsx("svg", {
							className: "select-check",
							viewBox: "0 0 16 16",
							width: "14",
							height: "14",
							"aria-hidden": "true",
							focusable: "false",
							children: /* @__PURE__ */ jsx("path", {
								d: "M3.5 8.5l3 3 6-7",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						})]
					}, item.index)), shown.length === 0 && /* @__PURE__ */ jsx("li", {
						className: "select-empty",
						role: "presentation",
						children: t$3("select.noMatches")
					})]
				})]
			}), document.body)
		]
	});
}
//#endregion
//#region src/views/builder2/InfoStep.jsx
function InfoStep({ d, apply, model, programList, courseList, onChooseCourse, onChooseProgram }) {
	const m = d.meta;
	const setM = (k, v) => apply((x) => {
		x.meta[k] = v;
		return x;
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "form-grid",
		children: [
			/* @__PURE__ */ jsxs(Field, {
				label: t$3("ui.program_2f03bb"),
				children: [/* @__PURE__ */ jsxs(Select, {
					value: m.program,
					onChange: (e) => onChooseProgram(e.target.value),
					"aria-label": t$3("ui.program_9d6800"),
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: t$3("ui.choose_a_program_2d5477")
					}), programList.map((p) => /* @__PURE__ */ jsx("option", {
						value: p.code,
						children: p.code + " – " + p.name
					}, p.code))]
				}), /* @__PURE__ */ jsx("span", {
					className: "linkline",
					children: t$3("outcomes.authorInStep2")
				})]
			}),
			/* @__PURE__ */ jsxs(Field, {
				label: t$3("ui.subject_i_ii_0cd15b"),
				children: [/* @__PURE__ */ jsxs(Select, {
					value: m.courseId || "",
					onChange: (e) => onChooseCourse(e.target.value ? Number(e.target.value) : null),
					"aria-label": t$3("ui.subject_8d183d"),
					disabled: !m.program || !courseList.length,
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: !m.program ? t$3("ui.choose_a_program_first_43fce3") : courseList.length ? t$3("ui.choose_a_subject_554b9c") : t$3("ui.no_subjects_yet_1e06ee")
					}), courseList.map((c) => {
						const taken = c.taken && c.id !== m.courseId ? c.taken : null;
						return /* @__PURE__ */ jsx("option", {
							value: c.id,
							disabled: !!taken,
							children: c.code + " – " + c.title + (taken ? " · " + (taken.status === "draft" ? t$3("builder.subjectHasDraft") : t$3("builder.subjectTaken", { status: tr(STATUS_LABELS[taken.status] || taken.status) })) : "")
						}, c.id);
					})]
				}), /* @__PURE__ */ jsx("span", {
					className: "linkline",
					children: !m.program ? t$3("ui.subjects_are_listed_by_program_41c330") : !courseList.length ? /* @__PURE__ */ jsxs("span", {
						style: { color: "var(--warn)" },
						children: [
							t$3("ui.no_subjects_have_been_added_for_679751"),
							m.program,
							t$3("ui.yet_an_administrator_adds_them_a9bb24")
						]
					}) : t$3("outcomes.subjectIdentity")
				})]
			}),
			/* @__PURE__ */ jsx(Field, {
				label: t$3("ui.credit_units_v_40ba2a"),
				children: /* @__PURE__ */ jsxs("span", {
					className: "units",
					children: [
						/* @__PURE__ */ jsx("input", {
							className: "mono",
							inputMode: "numeric",
							value: m.lecture,
							onChange: (e) => setM("lecture", e.target.value),
							"aria-label": t$3("ui.lecture_units_de9aaf"),
							maxLength: 4,
							style: {
								width: 74,
								textAlign: "center"
							}
						}),
						/* @__PURE__ */ jsx("span", { children: t$3("ui.units_lecture_2a1d2c") }),
						/* @__PURE__ */ jsx("input", {
							className: "mono",
							inputMode: "numeric",
							value: m.lab,
							onChange: (e) => setM("lab", e.target.value),
							"aria-label": t$3("ui.laboratory_units_067e02"),
							maxLength: 4,
							style: {
								width: 74,
								textAlign: "center"
							}
						}),
						/* @__PURE__ */ jsx("span", { children: t$3("ui.unit_laboratory_60e5a6") })
					]
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: t$3("hybrid.curriculumYear"),
				children: /* @__PURE__ */ jsx("input", {
					value: m.curriculumYear || "",
					onChange: (e) => setM("curriculumYear", e.target.value),
					"aria-label": t$3("hybrid.curriculumYear"),
					placeholder: t$3("hybrid.yearExample"),
					maxLength: 40
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: t$3("hybrid.yearLevel"),
				children: /* @__PURE__ */ jsx("input", {
					type: "number",
					min: "1",
					max: "8",
					value: m.yearLevel || "",
					onChange: (e) => setM("yearLevel", e.target.value),
					"aria-label": t$3("hybrid.yearLevel")
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: t$3("ui.pre_requisite_iv_1c46d5"),
				full: true,
				children: /* @__PURE__ */ jsx("input", {
					value: m.prereq,
					onChange: (e) => setM("prereq", e.target.value),
					"aria-label": t$3("ui.pre_requisite_d4ec8c"),
					maxLength: 255
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "field full",
				children: [
					/* @__PURE__ */ jsx("span", { children: t$3("ui.course_description_iii_db7708") }),
					d.description.map((x, i) => /* @__PURE__ */ jsxs("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "minmax(0,1fr) 28px",
							gap: 6,
							marginBottom: 8,
							alignItems: "start"
						},
						children: [/* @__PURE__ */ jsx(Auto, {
							className: "in",
							value: x.t,
							placeholder: t$3("ui.describe_the_course_in_a_few_sentences_8c883c"),
							label: t$3("ui.description_paragraph_207be8") + (i + 1),
							onChange: (v) => apply((z) => {
								z.description[i].t = v;
								return z;
							})
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ib del",
							"aria-label": t$3("ui.remove_paragraph_4bf624"),
							disabled: d.description.length < 2,
							onClick: () => apply((z) => {
								z.description.splice(i, 1);
								return z;
							}),
							children: /* @__PURE__ */ jsx(Ic, { n: "x" })
						})]
					}, x.id)),
					/* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("button", {
						type: "button",
						className: "link",
						onClick: () => apply((z) => {
							z.description.push({
								id: newId(),
								t: ""
							});
							return z;
						}),
						children: t$3("ui.add_paragraph_8df913")
					}) })
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "field full",
				children: /* @__PURE__ */ jsxs("div", {
					className: "auto",
					children: [
						/* @__PURE__ */ jsxs("span", { children: [t$3("ui.course_code_c3a63c"), /* @__PURE__ */ jsx("b", {
							className: "mono",
							children: m.code || "—"
						})] }),
						/* @__PURE__ */ jsxs("span", { children: [t$3("ui.course_title_b609b8"), /* @__PURE__ */ jsx("b", { children: m.title || "—" })] }),
						/* @__PURE__ */ jsxs("span", { children: [t$3("ui.school_year_fa59aa"), /* @__PURE__ */ jsx("b", {
							className: "mono",
							children: CURRENT_SCHOOL_YEAR.label
						})] }),
						/* @__PURE__ */ jsxs("span", { children: [t$3("ui.college_ef33db"), /* @__PURE__ */ jsx("b", { children: COLLEGE_NAME })] })
					]
				})
			})
		]
	});
}
//#endregion
//#region src/views/builder2/ReadOnlyOutcomes.jsx
function ReadOnlyOutcomes({ d, model }) {
	const I = model.institutionFor(d);
	const egas = model.egaList(d);
	const pos = model.poList(d);
	const [active, setActive] = useState(null);
	const [flash, setFlash] = useState(null);
	const jump = (id) => {
		const el = document.getElementById("clo-" + id);
		if (!el) return;
		el.scrollIntoView({
			behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
			block: "center"
		});
		setFlash(id);
		setTimeout(() => setFlash(null), 900);
	};
	const act = active ? d.clos.find((c) => c.id === active) : null;
	const usersOf = (kind, no) => d.clos.map((c, i) => (kind === "ega" ? c.egas : c.pos).includes(no) ? i : -1).filter((i) => i > -1);
	const hl = (kind, no) => act && (kind === "ega" ? act.egas : act.pos).includes(no) ? " hl" : "";
	const Used = ({ list }) => /* @__PURE__ */ jsx("span", {
		className: "used",
		"aria-label": t$3("ui.used_by_f5060a"),
		children: list.map((i) => /* @__PURE__ */ jsx("span", {
			className: "code sm k" + i % 6,
			children: t$3("ui.clo_069efc") + (i + 1)
		}, i))
	});
	if (!model.hasOutcomeSelection(d)) return /* @__PURE__ */ jsx("div", {
		className: "info-banner",
		role: "status",
		children: t$3("outcomes.chooseProgramSubject")
	});
	if (!model.outcomesReady(d)) return /* @__PURE__ */ jsx("div", {
		className: "info-banner warning",
		role: "status",
		children: t$3("outcomes.subjectIncomplete")
	});
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "vm",
			"aria-label": t$3("ui.vision_and_mission_4c8752"),
			children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
				className: "lbl",
				children: t$3("ui.vision_40b090")
			}), /* @__PURE__ */ jsx("p", { children: I.vision })] }), /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("span", {
					className: "lbl",
					children: t$3("ui.mission_e4698d")
				}),
				/* @__PURE__ */ jsx("p", { children: I.mission.lead }),
				/* @__PURE__ */ jsx("ul", { children: I.mission.items.map((t, k) => /* @__PURE__ */ jsx("li", { children: t }, k)) })
			] })]
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "refwrap",
			children: [/* @__PURE__ */ jsxs("table", {
				className: "ledger refs",
				children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("th", {
					style: { width: "38%" },
					children: t$3("ui.expected_graduate_attributes_86f980")
				}), /* @__PURE__ */ jsx("th", { children: t$3("ui.program_outcomes_b86d07") + (d.meta.program || tr("no program chosen")) })] }) }), /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("td", { children: egas.map((e) => /* @__PURE__ */ jsxs("div", {
					className: "refi" + hl("ega", e.no),
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "cd",
							children: t$3("ui.ega_4f085b") + e.no
						}),
						/* @__PURE__ */ jsx("span", {
							className: "rt",
							children: e.name
						}),
						/* @__PURE__ */ jsx(Used, { list: usersOf("ega", e.no) })
					]
				}, e.no)) }), /* @__PURE__ */ jsx("td", { children: pos.length ? pos.map((o) => /* @__PURE__ */ jsxs("div", {
					className: "refi" + hl("po", o.no),
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "cd",
							children: t$3("ui.po_3756d6") + o.no
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "rt",
							children: [o.text + " ", o.egas.map((g) => /* @__PURE__ */ jsx("span", {
								className: "map",
								children: t$3("ui.ega_7bee0f") + g + "] "
							}, g))]
						}),
						/* @__PURE__ */ jsx(Used, { list: usersOf("po", o.no) })
					]
				}, o.no)) : /* @__PURE__ */ jsx("div", {
					className: "hint",
					style: { padding: "8px 0" },
					children: d.meta.program ? t$3("ui.no_program_outcomes_are_loaded_for_db8e64") + d.meta.program + t$3("ui.an_administrator_adds_them_in_institution_settings_ddb051") : t$3("ui.choose_a_program_in_step_1_to_load_its_program_outcomes_d121f2")
				}) })] }) })]
			}), /* @__PURE__ */ jsx("div", {
				className: "hint",
				style: { marginTop: 6 },
				children: t$3("ui.the_badges_show_which_of_the_course_learning_outcomes_use_each_at_6463d4")
			})]
		}),
		/* @__PURE__ */ jsx("h3", {
			className: "sech",
			children: t$3("ui.course_learning_outcomes_503861") + (d.meta.code ? " · " + d.meta.code : "")
		}),
		!d.meta.courseId && /* @__PURE__ */ jsx("div", {
			className: "info-banner",
			children: t$3("ui.choose_a_subject_in_step_1_to_load_its_learning_outcomes_017d6f")
		}),
		d.meta.courseId && !d.clos.length && /* @__PURE__ */ jsxs("div", {
			className: "info-banner warning",
			children: [
				t$3("ui.no_learning_outcomes_are_defined_for_abd5b1"),
				d.meta.code,
				t$3("ui.yet_an_administrator_adds_them_in_subjects_amp_clos_2e8b78")
			]
		}),
		/* @__PURE__ */ jsx(CoverageStrip, {
			model,
			d,
			filter: null,
			onPick: jump
		}),
		d.clos.map((c, i) => /* @__PURE__ */ jsxs("div", {
			className: "clorow" + (flash === c.id ? " flash" : ""),
			id: "clo-" + c.id,
			onMouseEnter: () => setActive(c.id),
			onMouseLeave: () => setActive(null),
			onFocus: () => setActive(c.id),
			tabIndex: 0,
			children: [
				/* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", {
					className: "code lg k" + i % 6,
					children: t$3("ui.clo_069efc") + (i + 1)
				}) }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
					className: "cap",
					children: [/* @__PURE__ */ jsx("strong", { children: c.level }), c.title && /* @__PURE__ */ jsx("span", {
						className: "hint",
						children: " (" + c.title + ")"
					})]
				}), /* @__PURE__ */ jsx("p", {
					style: {
						margin: 0,
						lineHeight: 1.5
					},
					children: c.statement
				})] }),
				/* @__PURE__ */ jsxs("div", {
					className: "col2",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "lbl",
							children: t$3("ui.expected_graduate_attributes_86f980")
						}),
						/* @__PURE__ */ jsx("div", {
							className: "tags",
							children: c.egas.length ? c.egas.map((n) => /* @__PURE__ */ jsx(Tag, { info: model.tagInfo(d, "ega:" + n) }, "e" + n)) : /* @__PURE__ */ jsx("span", {
								className: "hint",
								children: t$3("ui.none_6eef66")
							})
						}),
						/* @__PURE__ */ jsx("span", {
							className: "lbl",
							style: { marginTop: 12 },
							children: t$3("ui.program_outcomes_858de9")
						}),
						/* @__PURE__ */ jsx("div", {
							className: "tags",
							children: c.pos.length ? c.pos.map((n) => /* @__PURE__ */ jsx(Tag, { info: model.tagInfo(d, "po:" + n) }, "p" + n)) : /* @__PURE__ */ jsx("span", {
								className: "hint",
								children: t$3("ui.none_6eef66")
							})
						})
					]
				})
			]
		}, c.id)),
		/* @__PURE__ */ jsx("p", {
			className: "legend",
			children: t$3("ui.clo_numbers_follow_the_order_in_the_subject_catalog_in_step_3_you_bbf7d3")
		})
	] });
}
//#endregion
//#region src/views/builder2/ClosStep.jsx
function ClosStep({ d, model, apply, editable = !!apply }) {
	if (!editable) return /* @__PURE__ */ jsx(ReadOnlyOutcomes, {
		d,
		model
	});
	if (!model.hasOutcomeSelection(d)) return /* @__PURE__ */ jsx("div", {
		className: "info-banner",
		role: "status",
		children: t$3("outcomes.chooseProgramSubject")
	});
	const o = d.outcomes || {
		...model.institutionFor(d),
		egas: model.egaList(d),
		pos: model.poList(d)
	};
	const edit = (fn) => apply((next) => {
		if (!next.outcomes) next.outcomes = JSON.parse(JSON.stringify(o));
		fn(next.outcomes, next);
		return next;
	});
	const toggle = (values, no) => values.includes(no) ? values.filter((n) => n !== no) : [...values, no].sort((a, b) => a - b);
	const usesTag = (tag) => d.plan.some((row) => row.ilos.some((il) => il.tags.includes(tag)));
	const egaUsed = (no) => o.pos.some((p) => p.egas.includes(no)) || d.clos.some((c) => c.egas.includes(no)) || usesTag("ega:" + no);
	const poUsed = (no) => d.clos.some((c) => c.pos.includes(no)) || usesTag("po:" + no);
	const nextNo = (rows) => Math.max(0, ...rows.map((row) => row.no)) + 1;
	const mapChoices = (rows, values, onChange, label) => /* @__PURE__ */ jsx("div", {
		className: "ie-egas",
		role: "group",
		"aria-label": label,
		children: rows.map((row) => /* @__PURE__ */ jsxs("label", {
			className: "ie-chip" + (values.includes(row.no) ? " on" : ""),
			title: row.name || row.text,
			children: [/* @__PURE__ */ jsx("input", {
				type: "checkbox",
				checked: values.includes(row.no),
				onChange: () => onChange(toggle(values, row.no))
			}), label + " " + row.no]
		}, row.no))
	});
	const removeButton = (label, disabled, onClick) => /* @__PURE__ */ jsx("button", {
		type: "button",
		className: "ib del",
		"aria-label": label,
		title: disabled ? t$3("outcomes.inUse") : label,
		disabled,
		onClick,
		children: /* @__PURE__ */ jsx(Icon, {
			name: "bin",
			size: 16
		})
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "sm-stack learning-outcomes-editor",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "hint",
				children: t$3("outcomes.authoringNote")
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "sm-card",
				children: [/* @__PURE__ */ jsx("header", {
					className: "sm-card-h",
					children: /* @__PURE__ */ jsx("h4", { children: t$3("ui.vision_and_mission_4c8752") })
				}), /* @__PURE__ */ jsxs("div", {
					className: "sm-card-b",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "field",
							children: [/* @__PURE__ */ jsx("span", { children: t$3("ui.vision_40b090") }), /* @__PURE__ */ jsx(Auto, {
								className: "in",
								value: o.vision,
								label: t$3("ui.vision_40b090"),
								onChange: (value) => edit((x) => {
									x.vision = value;
								})
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "field",
							children: [/* @__PURE__ */ jsx("span", { children: t$3("ui.mission_introduction_873ac6") }), /* @__PURE__ */ jsx(Auto, {
								className: "in",
								value: o.mission.lead,
								label: t$3("ui.mission_introduction_8acfc4"),
								onChange: (value) => edit((x) => {
									x.mission.lead = value;
								})
							})]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "lbl",
							children: t$3("ui.mission_statements_5e2923")
						}),
						o.mission.items.map((text, i) => /* @__PURE__ */ jsxs("div", {
							className: "ie-row",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "mono ie-no",
									children: i + 1
								}),
								/* @__PURE__ */ jsx(Auto, {
									className: "in",
									value: text,
									label: t$3("ui.mission_statement_45b2a8") + (i + 1),
									onChange: (value) => edit((x) => {
										x.mission.items[i] = value;
									})
								}),
								removeButton(t$3("ui.remove_statement_100039") + (i + 1), false, () => edit((x) => {
									x.mission.items.splice(i, 1);
								}))
							]
						}, i)),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "link",
							disabled: o.mission.items.length >= 50,
							onClick: () => edit((x) => {
								x.mission.items.push("");
							}),
							children: t$3("ui.add_mission_statement_0ad1c2")
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sm-pair",
				children: [/* @__PURE__ */ jsxs("section", {
					className: "sm-card",
					children: [/* @__PURE__ */ jsx("header", {
						className: "sm-card-h",
						children: /* @__PURE__ */ jsx("h4", { children: t$3("ui.expected_graduate_attributes_86f980") })
					}), /* @__PURE__ */ jsxs("div", {
						className: "sm-card-b",
						children: [o.egas.map((e, i) => /* @__PURE__ */ jsxs("div", {
							className: "ie-ega",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "code ref mono",
									children: t$3("ui.ega_4f085b") + e.no
								}),
								/* @__PURE__ */ jsx("input", {
									className: "in",
									value: e.name,
									maxLength: 255,
									placeholder: t$3("ui.full_name_eeb692"),
									"aria-label": t$3("ui.name_of_ega_3dfa90") + e.no,
									onChange: (event) => {
										const value = event.target.value;
										edit((x) => {
											x.egas[i].name = value;
										});
									}
								}),
								/* @__PURE__ */ jsx("input", {
									className: "in",
									value: e.short,
									maxLength: 120,
									placeholder: t$3("ui.short_name_feb5a9"),
									"aria-label": t$3("ui.short_name_of_ega_231166") + e.no,
									onChange: (event) => {
										const value = event.target.value;
										edit((x) => {
											x.egas[i].short = value;
										});
									}
								}),
								removeButton(t$3("ui.remove_ega_8c32e7") + e.no, egaUsed(e.no), () => edit((x) => {
									x.egas.splice(i, 1);
								}))
							]
						}, e.no)), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "link",
							disabled: o.egas.length >= 20,
							onClick: () => edit((x) => {
								x.egas.push({
									no: nextNo(x.egas),
									name: "",
									short: ""
								});
							}),
							children: t$3("ui.add_ega_270a20")
						})]
					})]
				}), /* @__PURE__ */ jsxs("section", {
					className: "sm-card",
					children: [/* @__PURE__ */ jsx("header", {
						className: "sm-card-h",
						children: /* @__PURE__ */ jsx("h4", { children: t$3("ui.program_outcomes_858de9") })
					}), /* @__PURE__ */ jsxs("div", {
						className: "sm-card-b",
						children: [o.pos.map((p, i) => /* @__PURE__ */ jsxs("div", {
							className: "ie-po",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "code ref mono",
									children: t$3("ui.po_3756d6") + p.no
								}),
								/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsx("input", {
										className: "in",
										value: p.short,
										maxLength: 120,
										placeholder: t$3("ui.short_name_feb5a9"),
										"aria-label": t$3("ui.short_name_of_po_452bca") + p.no,
										onChange: (event) => {
											const value = event.target.value;
											edit((x) => {
												x.pos[i].short = value;
											});
										}
									}),
									/* @__PURE__ */ jsx(Auto, {
										className: "in",
										value: p.text,
										label: t$3("ui.statement_of_po_0182b3") + p.no,
										onChange: (value) => edit((x) => {
											x.pos[i].text = value;
										})
									}),
									mapChoices(o.egas, p.egas, (values) => edit((x) => {
										x.pos[i].egas = values;
									}), t$3("ui.ega_4f085b"))
								] }),
								removeButton(t$3("ui.remove_po_ffe9b3") + p.no, poUsed(p.no), () => edit((x) => {
									x.pos.splice(i, 1);
								}))
							]
						}, p.no)), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "link",
							disabled: o.pos.length >= 50,
							onClick: () => edit((x) => {
								x.pos.push({
									no: nextNo(x.pos),
									short: "",
									text: "",
									egas: []
								});
							}),
							children: t$3("ui.add_program_outcome_cd9147")
						})]
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "sm-card",
				children: [/* @__PURE__ */ jsx("header", {
					className: "sm-card-h",
					children: /* @__PURE__ */ jsx("h4", { children: t$3("ui.course_learning_outcomes_503861") })
				}), /* @__PURE__ */ jsxs("div", {
					className: "sm-card-b",
					children: [
						d.clos.map((c, i) => /* @__PURE__ */ jsxs("div", {
							className: "clorow",
							id: "clo-" + c.id,
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "code lg k" + i % 6,
									children: t$3("ui.clo_069efc") + (i + 1)
								}),
								/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsxs("div", {
										className: "cap",
										children: [/* @__PURE__ */ jsx(Select, {
											className: "sel",
											value: c.level,
											"aria-label": t$3("ui.level_of_clo_c01e3f") + (i + 1),
											onChange: (event) => {
												const value = event.target.value;
												edit((x, next) => {
													next.clos[i].level = value;
												});
											},
											children: LEVELS.map((level) => /* @__PURE__ */ jsx("option", {
												value: level,
												children: tr(level)
											}, level))
										}), removeButton(t$3("ui.delete_clo_3a0c81") + (i + 1), usesTag("clo:" + c.id), () => edit((x, next) => {
											next.clos.splice(i, 1);
										}))]
									}),
									/* @__PURE__ */ jsx("input", {
										className: "in",
										value: c.title,
										maxLength: 255,
										placeholder: t$3("ui.descriptor_e_g_foundational_knowledge_3cc9d7"),
										"aria-label": t$3("ui.title_of_clo_04eb8b") + (i + 1),
										onChange: (event) => {
											const value = event.target.value;
											edit((x, next) => {
												next.clos[i].title = value;
											});
										}
									}),
									/* @__PURE__ */ jsx(Auto, {
										className: "in",
										value: c.statement,
										label: t$3("ui.statement_of_clo_13551f") + (i + 1),
										onChange: (value) => edit((x, next) => {
											next.clos[i].statement = value;
										})
									})
								] }),
								/* @__PURE__ */ jsxs("div", {
									className: "col2",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "lbl",
											children: t$3("ui.expected_graduate_attributes_86f980")
										}),
										mapChoices(o.egas, c.egas, (values) => edit((x, next) => {
											next.clos[i].egas = values;
										}), t$3("ui.ega_4f085b")),
										/* @__PURE__ */ jsx("span", {
											className: "lbl",
											children: t$3("ui.program_outcomes_858de9")
										}),
										mapChoices(o.pos, c.pos, (values) => edit((x, next) => {
											next.clos[i].pos = values;
										}), t$3("ui.po_3756d6"))
									]
								})
							]
						}, c.id)),
						/* @__PURE__ */ jsx(StableButton, {
							type: "button",
							className: "btn outline",
							disabled: d.clos.length >= 20,
							onClick: () => edit((x, next) => {
								next.clos.push({
									id: newId(),
									title: "",
									level: "Enabling",
									statement: "",
									egas: [],
									pos: []
								});
							}),
							children: t$3("ui.add_clo_0485ad")
						}),
						/* @__PURE__ */ jsx(CoverageStrip, {
							model,
							d,
							filter: null,
							onPick: (id) => document.getElementById("clo-" + id)?.scrollIntoView({ block: "center" })
						})
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/views/builder2/PlanStep.jsx
const newIlo = () => ({
	id: newId(),
	text: "",
	tags: []
});
const CELLS = [
	["contents", "Topics covered"],
	["activities", "- One per line"],
	["tasks", "- One per line"],
	["values", "**Core value**"]
];
const Formatted = ({ text }) => /* @__PURE__ */ jsx("div", {
	className: "fmt",
	dangerouslySetInnerHTML: { __html: renderMarkup(text) || "<span style=\"color:var(--muted)\">—</span>" }
});
function PlanStep({ d, apply, model, filter, setFilter, onDeleteRow }) {
	const [picker, setPicker] = useState(null);
	const [mode, setMode] = useState("edit");
	const edit = mode === "edit";
	const shown = d.plan.filter((r) => !filter || model.rowHits(d, r).includes(filter));
	const weeks = Object.keys(weekSet(d.plan)).length;
	const updRow = (id, fn) => apply((x) => {
		const r = x.plan.find((y) => y.id === id);
		if (r) fn(r);
		return x;
	});
	const move = (id, delta) => apply((x) => {
		const i = x.plan.findIndex((y) => y.id === id);
		const j = i + delta;
		if (j < 0 || j >= x.plan.length) return x;
		x.plan.splice(j, 0, x.plan.splice(i, 1)[0]);
		return x;
	});
	const addRow = (kind) => {
		const mx = Math.max(0, ...Object.keys(weekSet(d.plan)).map(Number));
		const r = {
			id: newId(),
			kind,
			week: String(mx + 1),
			ilos: [newIlo()],
			contents: kind === "exam" ? "**EXAMINATION**" : "",
			activities: kind === "exam" ? "- Examination" : "",
			tasks: "",
			values: ""
		};
		apply((x) => {
			x.plan.push(r);
			return x;
		});
		setTimeout(() => {
			const el = document.querySelector("[data-fid=\"" + r.id + "\"]");
			if (el) el.focus();
		}, 40);
	};
	const pr = picker ? d.plan.find((r) => r.id === picker.row) : null;
	const pil = pr ? pr.ilos.find((x) => x.id === picker.ilo) : null;
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx(CoverageStrip, {
			model,
			d,
			filter,
			onPick: (id) => setFilter(filter === id ? null : id)
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "tbar",
			children: [/* @__PURE__ */ jsx("div", {
				className: "filterline",
				children: filter ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
					/* @__PURE__ */ jsx("span", { children: t$3("ui.showing_85a4af") + shown.length + t$3("ui.of_607f2d") + d.plan.length + t$3("ui.rows_that_build_fd23e7") }),
					/* @__PURE__ */ jsx(Tag, { info: model.tagInfo(d, "clo:" + filter) }),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "link",
						onClick: () => setFilter(null),
						children: t$3("ui.clear_filter_b667d6")
					})
				] }) : /* @__PURE__ */ jsxs("span", { children: [
					/* @__PURE__ */ jsx("span", {
						className: "mono",
						style: {
							color: "var(--text)",
							fontWeight: 600
						},
						children: weeks + t$3("ui.of_18_7cd558")
					}),
					t$3("ui.weeks_covered_use_f7d2f0"),
					/* @__PURE__ */ jsx("span", {
						className: "mono",
						children: "-"
					}),
					t$3("ui.for_bullets_and_58b7a5"),
					/* @__PURE__ */ jsx("span", {
						className: "mono",
						children: t$3("ui.bold_40b7d4")
					}),
					t$3("ui.for_labels_b0d83a")
				] })
			}), /* @__PURE__ */ jsxs("div", {
				className: "seg",
				role: "group",
				"aria-label": t$3("ui.cell_view_163f49"),
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-pressed": edit,
					onClick: () => setMode("edit"),
					children: t$3("ui.edit_530164")
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-pressed": !edit,
					onClick: () => setMode("fmt"),
					children: t$3("ui.formatted_f26356")
				})]
			})]
		}),
		/* @__PURE__ */ jsx("div", {
			className: "scroll",
			children: /* @__PURE__ */ jsxs("table", {
				className: "ledger plan",
				children: [
					/* @__PURE__ */ jsxs("colgroup", { children: [
						/* @__PURE__ */ jsx("col", { style: { width: "96px" } }),
						/* @__PURE__ */ jsx("col", { style: { width: "31%" } }),
						/* @__PURE__ */ jsx("col", { style: { width: "14%" } }),
						/* @__PURE__ */ jsx("col", { style: { width: "17%" } }),
						/* @__PURE__ */ jsx("col", { style: { width: "15%" } }),
						/* @__PURE__ */ jsx("col", {})
					] }),
					/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx("th", { children: t$3("ui.week_f82be6") }),
						/* @__PURE__ */ jsx("th", { children: t$3("plan.heading.ilo") }),
						/* @__PURE__ */ jsx("th", { children: t$3("plan.heading.contents") }),
						/* @__PURE__ */ jsx("th", { children: t$3("plan.heading.activities") }),
						/* @__PURE__ */ jsx("th", { children: t$3("plan.heading.tasks") }),
						/* @__PURE__ */ jsx("th", { children: t$3("plan.heading.values") })
					] }) }),
					/* @__PURE__ */ jsxs("tbody", { children: [shown.map((r) => {
						const full = d.plan.findIndex((y) => y.id === r.id);
						const exam = r.kind === "exam";
						return /* @__PURE__ */ jsxs("tr", {
							className: exam ? "exam" : "",
							children: [
								/* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("div", {
									className: "wkc",
									children: [
										edit ? /* @__PURE__ */ jsx("input", {
											className: "cell",
											value: r.week,
											"data-fid": r.id,
											"aria-label": t$3("ui.week_f82be6"),
											placeholder: t$3("ui.week_f82be6"),
											onChange: (e) => {
												const v = e.target.value;
												updRow(r.id, (x) => {
													x.week = v;
												});
											}
										}) : /* @__PURE__ */ jsx("div", {
											className: "fmt mono",
											style: { fontWeight: 600 },
											children: t$3("ui.wk_1e49a0") + r.week
										}),
										edit && /* @__PURE__ */ jsxs(Select, {
											className: "kind",
											value: r.kind,
											"aria-label": t$3("ui.row_type_91d899"),
											onChange: (e) => {
												const v = e.target.value;
												updRow(r.id, (x) => {
													x.kind = v;
												});
											},
											children: [/* @__PURE__ */ jsx("option", {
												value: "lesson",
												children: t$3("ui.lesson_0bb7c8")
											}), /* @__PURE__ */ jsx("option", {
												value: "exam",
												children: t$3("ui.exam_c7e542")
											})]
										}),
										edit && /* @__PURE__ */ jsxs("div", {
											className: "racts",
											children: [
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "ib",
													"aria-label": t$3("ui.move_up_b4f57c"),
													disabled: full === 0,
													onClick: () => move(r.id, -1),
													children: /* @__PURE__ */ jsx(Ic, { n: "up" })
												}),
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "ib",
													"aria-label": t$3("ui.move_down_260ff8"),
													disabled: full === d.plan.length - 1,
													onClick: () => move(r.id, 1),
													children: /* @__PURE__ */ jsx(Ic, { n: "down" })
												}),
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "ib",
													"aria-label": t$3("ui.duplicate_row_d66d5f"),
													onClick: () => apply((x) => {
														const c = clone(r);
														c.id = newId();
														c.week = "";
														c.ilos.forEach((il) => {
															il.id = newId();
														});
														x.plan.splice(full + 1, 0, c);
														return x;
													}),
													children: /* @__PURE__ */ jsx(Ic, { n: "copy" })
												}),
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "ib del",
													"aria-label": t$3("ui.delete_row_fcf3f8"),
													onClick: () => onDeleteRow(r.id),
													children: /* @__PURE__ */ jsx(Icon, {
														name: "bin",
														size: 16
													})
												})
											]
										})
									]
								}) }),
								/* @__PURE__ */ jsx("td", { children: exam ? edit ? /* @__PURE__ */ jsx(Auto, {
									value: r.ilos[0] ? r.ilos[0].text : "",
									placeholder: t$3("ui.review_of_topics_235cbc"),
									label: t$3("ui.review_topics_520343"),
									onChange: (v) => updRow(r.id, (x) => {
										if (!x.ilos[0]) x.ilos.push(newIlo());
										x.ilos[0].text = v;
									})
								}) : /* @__PURE__ */ jsx(Formatted, { text: r.ilos[0] ? r.ilos[0].text : "" }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [r.ilos.map((il, j) => /* @__PURE__ */ jsxs("div", {
									className: "ilo",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "lb",
											children: t$3("ui.ilo_080517") + (j + 1)
										}),
										edit ? /* @__PURE__ */ jsx(Auto, {
											value: il.text,
											placeholder: t$3("ui.start_with_a_verb_6b1d63"),
											label: t$3("ui.ilo_f12fa1") + (j + 1) + t$3("ui.of_week_60075b") + r.week,
											onChange: (v) => updRow(r.id, (x) => {
												x.ilos[j].text = v;
											})
										}) : /* @__PURE__ */ jsx("div", {
											className: "fmt typed-text",
											children: il.text || "—"
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "tagrow",
											children: [
												il.tags.map((t) => /* @__PURE__ */ jsx(Tag, {
													info: model.tagInfo(d, t),
													onRemove: edit ? () => updRow(r.id, (x) => {
														x.ilos[j].tags = x.ilos[j].tags.filter((v) => v !== t);
													}) : null
												}, t)),
												edit && /* @__PURE__ */ jsx("button", {
													type: "button",
													className: "tagbtn",
													"aria-label": t$3("ui.tag_outcomes_for_ilo_5f768a") + (j + 1),
													onClick: (e) => setPicker({
														row: r.id,
														ilo: il.id,
														rect: e.currentTarget.getBoundingClientRect()
													}),
													children: t$3("ui.tag_eae765")
												}),
												edit && r.ilos.length > 1 && /* @__PURE__ */ jsx("button", {
													type: "button",
													className: "ib del",
													"aria-label": t$3("ui.remove_ilo_4d0e7b"),
													onClick: () => updRow(r.id, (x) => {
														x.ilos.splice(j, 1);
													}),
													children: /* @__PURE__ */ jsx(Ic, { n: "x" })
												})
											]
										})
									]
								}, il.id)), edit && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "link",
									onClick: () => updRow(r.id, (x) => {
										x.ilos.push(newIlo());
									}),
									children: t$3("ui.ilo_b41960")
								})] }) }),
								CELLS.map(([f, ph]) => /* @__PURE__ */ jsx("td", { children: edit ? /* @__PURE__ */ jsx(Auto, {
									value: r[f],
									placeholder: ph,
									label: f + t$3("ui.of_week_60075b") + r.week,
									onChange: (v) => updRow(r.id, (x) => {
										x[f] = v;
									})
								}) : /* @__PURE__ */ jsx(Formatted, { text: r[f] }) }, f))
							]
						}, r.id);
					}), !shown.length && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
						colSpan: "6",
						style: {
							padding: 24,
							color: "var(--muted)"
						},
						children: filter ? t$3("ui.no_rows_build_this_clo_yet_tag_an_ilo_with_it_or_clear_the_filter_f917f8") : t$3("ui.no_rows_yet_a2e4b6")
					}) })] })
				]
			})
		}),
		edit && /* @__PURE__ */ jsxs("div", {
			className: "addrow",
			children: [/* @__PURE__ */ jsx(StableButton, {
				type: "button",
				className: "btn outline",
				onClick: () => addRow("lesson"),
				children: t$3("ui.add_week_3a833d")
			}), /* @__PURE__ */ jsx(StableButton, {
				type: "button",
				className: "btn outline",
				onClick: () => addRow("exam"),
				children: t$3("ui.add_exam_row_19d3c0")
			})]
		}),
		picker && pil && /* @__PURE__ */ jsx(OutcomePicker, {
			model,
			d,
			kinds: [
				"clo",
				"ega",
				"po"
			],
			rect: picker.rect,
			title: t$3("ui.tag_outcomes_9af691"),
			selected: pil.tags,
			onClose: () => setPicker(null),
			onToggle: (t) => updRow(picker.row, (x) => {
				const il = x.ilos.find((y) => y.id === picker.ilo);
				if (il) il.tags = il.tags.includes(t) ? il.tags.filter((v) => v !== t) : [...il.tags, t];
			})
		})
	] });
}
//#endregion
//#region src/views/builder2/ReqStep.jsx
const focusId$1 = (id) => setTimeout(() => {
	const el = document.querySelector("[data-fid=\"" + id + "\"]");
	if (el) el.focus();
}, 30);
function ReqStep({ d, apply, model }) {
	const suggestions = model.suggestReqs(d);
	const keys = (i) => (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			const n = {
				id: newId(),
				t: ""
			};
			apply((x) => {
				x.reqs.splice(i + 1, 0, n);
				return x;
			});
			focusId$1(n.id);
		} else if (e.key === "Backspace" && d.reqs[i].t === "" && d.reqs.length > 1) {
			e.preventDefault();
			const prev = d.reqs[i - 1] || d.reqs[i + 1];
			apply((x) => {
				x.reqs.splice(i, 1);
				return x;
			});
			if (prev) focusId$1(prev.id);
		}
	};
	return /* @__PURE__ */ jsxs("div", { children: [
		d.reqs.map((r, i) => /* @__PURE__ */ jsxs("div", {
			className: "item",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "no",
					children: i + 1 + "."
				}),
				/* @__PURE__ */ jsx(Auto, {
					value: r.t,
					fid: r.id,
					placeholder: t$3("ui.requirement_e9c366"),
					label: t$3("ui.requirement_15c842") + (i + 1),
					onChange: (v) => apply((x) => {
						x.reqs[i].t = v;
						return x;
					}),
					onKeyDown: keys(i)
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ib del",
					"aria-label": t$3("ui.remove_requirement_425573"),
					onClick: () => apply((x) => {
						x.reqs.splice(i, 1);
						return x;
					}),
					children: /* @__PURE__ */ jsx(Ic, { n: "x" })
				})
			]
		}, r.id)),
		/* @__PURE__ */ jsxs("div", {
			style: { marginTop: 8 },
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "link",
				onClick: () => {
					const n = {
						id: newId(),
						t: ""
					};
					apply((x) => {
						x.reqs.push(n);
						return x;
					});
					focusId$1(n.id);
				},
				children: t$3("ui.add_requirement_a73fac")
			}), /* @__PURE__ */ jsx("span", {
				className: "hint",
				children: t$3("ui.enter_adds_the_next_line_10a028")
			})]
		}),
		suggestions.length > 0 && /* @__PURE__ */ jsxs("div", {
			style: { marginTop: 22 },
			children: [/* @__PURE__ */ jsx("span", {
				className: "lbl",
				children: t$3("ui.from_your_assessment_tasks_in_step_3_860593")
			}), /* @__PURE__ */ jsx("div", {
				className: "sugg",
				children: suggestions.map((t) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => apply((x) => {
						x.reqs.push({
							id: newId(),
							t
						});
						return x;
					}),
					children: "+ " + t
				}, t))
			})]
		})
	] });
}
//#endregion
//#region src/views/builder2/RefsStep.jsx
const focusId = (id) => setTimeout(() => {
	const el = document.querySelector("[data-fid=\"" + id + "\"]");
	if (el) el.focus();
}, 30);
function RefsStep({ d, apply, model }) {
	return /* @__PURE__ */ jsx("div", { children: GROUPS.map(([key, title]) => {
		const grp = d.refs[key];
		return /* @__PURE__ */ jsxs("div", {
			className: "grp",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "grp-h",
				children: [/* @__PURE__ */ jsxs("h3", { children: [tr(title), /* @__PURE__ */ jsx("span", {
					className: "mono",
					style: {
						marginLeft: 8,
						fontWeight: 500
					},
					children: grp.items.filter((x) => x.t.trim()).length
				})] }), /* @__PURE__ */ jsxs("label", {
					className: "na",
					children: [/* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: grp.na,
						onChange: (e) => {
							const v = e.target.checked;
							apply((x) => {
								x.refs[key].na = v;
								return x;
							});
						}
					}), t$3("ui.not_applicable_67c4d0")]
				})]
			}), grp.na ? /* @__PURE__ */ jsx("div", {
				className: "hint",
				style: { padding: "8px 0" },
				children: t$3("ui.marked_not_applicable_for_this_course_b1c227")
			}) : /* @__PURE__ */ jsxs("div", { children: [grp.items.map((r, i) => {
				const a = model.refAge(r.t);
				return /* @__PURE__ */ jsxs("div", {
					className: "item",
					style: { gridTemplateColumns: "8px minmax(0,1fr) auto 28px" },
					children: [
						/* @__PURE__ */ jsx("span", {}),
						/* @__PURE__ */ jsx(Auto, {
							value: r.t,
							fid: r.id,
							placeholder: t$3("ui.reference_db1c78"),
							label: tr(title) + t$3("ui.reference_523d48") + (i + 1),
							onChange: (v) => apply((x) => {
								x.refs[key].items[i].t = v;
								return x;
							}),
							onKeyDown: (e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									const n = {
										id: newId(),
										t: ""
									};
									apply((x) => {
										x.refs[key].items.splice(i + 1, 0, n);
										return x;
									});
									focusId(n.id);
								}
							}
						}),
						a && a.age > 10 ? /* @__PURE__ */ jsx("span", {
							className: "age",
							title: t$3("ui.more_than_10_years_older_than_school_year_0390a8") + CURRENT_SCHOOL_YEAR.label,
							children: a.year + " · " + a.age + t$3("ui.yrs_a00f7d")
						}) : /* @__PURE__ */ jsx("span", {}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "ib del",
							"aria-label": t$3("ui.remove_reference_629558"),
							onClick: () => apply((x) => {
								x.refs[key].items.splice(i, 1);
								return x;
							}),
							children: /* @__PURE__ */ jsx(Ic, { n: "x" })
						})
					]
				}, r.id);
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "link",
				onClick: () => {
					const n = {
						id: newId(),
						t: ""
					};
					apply((x) => {
						x.refs[key].items.push(n);
						return x;
					});
					focusId(n.id);
				},
				children: t$3("ui.add_reference_081ae6")
			})] })]
		}, key);
	}) });
}
//#endregion
//#region src/views/builder2/GradeStep.jsx
const PCT = /^\d{0,3}(\.\d{0,2})?$/;
function GradeStep({ d, apply, model }) {
	const g = d.grading;
	const total = gradeTotal(d);
	const f = model.formulas(d);
	const exams = examRows(d).length;
	const upd = (fn) => apply((x) => {
		fn(x.grading);
		return x;
	});
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx("div", { children: g.rows.map((r, i) => /* @__PURE__ */ jsxs("div", {
			className: "grow",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "mono",
					style: {
						padding: "8px 0 0 6px",
						color: "var(--muted)"
					},
					children: i + 1 + "."
				}),
				/* @__PURE__ */ jsx("input", {
					className: "cell",
					value: r.label,
					placeholder: t$3("ui.component_c92c52"),
					"aria-label": t$3("ui.component_c92c52"),
					onChange: (e) => {
						const v = e.target.value;
						upd((x) => {
							x.rows[i].label = v;
						});
					}
				}),
				/* @__PURE__ */ jsx("input", {
					className: "cell mono",
					value: r.abbr,
					placeholder: t$3("ui.abbr_b9bce8"),
					"aria-label": t$3("ui.abbreviation_cd4378"),
					maxLength: 8,
					onChange: (e) => {
						const v = e.target.value.toUpperCase();
						upd((x) => {
							x.rows[i].abbr = v;
						});
					}
				}),
				/* @__PURE__ */ jsxs("span", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 4
					},
					children: [/* @__PURE__ */ jsx("input", {
						className: "cell mono",
						inputMode: "decimal",
						value: r.pct,
						"aria-label": (r.label || tr("Component")) + t$3("ui.percent_dff0eb"),
						onChange: (e) => {
							const v = e.target.value;
							if (PCT.test(v)) upd((x) => {
								x.rows[i].pct = v;
							});
						}
					}), /* @__PURE__ */ jsx("span", {
						className: "mono",
						children: "%"
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "ib del",
					"aria-label": t$3("ui.remove_component_200c43"),
					onClick: () => upd((x) => {
						x.rows.splice(i, 1);
					}),
					children: /* @__PURE__ */ jsx(Ic, { n: "x" })
				})
			]
		}, r.id)) }),
		/* @__PURE__ */ jsx("button", {
			type: "button",
			className: "link",
			onClick: () => upd((x) => {
				x.rows.push({
					id: newId(),
					label: "",
					abbr: "",
					pct: ""
				});
			}),
			children: t$3("ui.add_component_2364b5")
		}),
		/* @__PURE__ */ jsx("div", {
			className: "gbar",
			role: "img",
			"aria-label": t$3("ui.weights_cd9b0c") + g.rows.map((r) => (r.label || "Component") + " " + (Number(r.pct) || 0) + "%").join(", "),
			children: g.rows.map((r) => /* @__PURE__ */ jsx("i", { style: { width: Math.min(100, Number(r.pct) || 0) + "%" } }, r.id))
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "total" + (total === 100 ? "" : " bad"),
			children: [
				/* @__PURE__ */ jsx("span", { children: t$3("ui.total_b25928") }),
				/* @__PURE__ */ jsx("span", {
					className: "mono",
					children: total + "%"
				}),
				total !== 100 && /* @__PURE__ */ jsx("span", {
					className: "hint",
					children: t$3("ui.should_be_100_655251")
				})
			]
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "eq",
			"aria-live": "polite",
			children: [
				/* @__PURE__ */ jsx("div", { children: f.term }),
				/* @__PURE__ */ jsx("div", { children: f.final }),
				/* @__PURE__ */ jsx("div", {
					className: "l",
					children: exams < 3 ? t$3("ui.final_rating_lists_29eda9") + exams + t$3("ui.of_3_terms_add_the_missing_exam_rows_in_step_3_694862") : t$3("ui.final_rating_is_built_from_your_496f08") + exams + t$3("ui.exam_rows_db6139")
				})
			]
		}),
		/* @__PURE__ */ jsxs("label", {
			className: "sw",
			children: [/* @__PURE__ */ jsx("input", {
				type: "checkbox",
				checked: g.override.on,
				onChange: (e) => {
					const v = e.target.checked;
					upd((x) => {
						x.override.on = v;
						if (v && !x.override.term) {
							const gen = model.formulas({
								grading: {
									rows: x.rows,
									override: { on: false }
								},
								plan: d.plan
							});
							x.override.term = gen.genTerm;
							x.override.final = gen.genFinal;
						}
					});
				}
			}), t$3("ui.write_the_formulas_myself_8320f5")]
		}),
		g.override.on && /* @__PURE__ */ jsxs("div", {
			className: "form-grid",
			style: { marginTop: 10 },
			children: [/* @__PURE__ */ jsxs("label", {
				className: "field",
				children: [/* @__PURE__ */ jsx("span", { children: t$3("ui.term_grade_2e36c7") }), /* @__PURE__ */ jsx("input", {
					className: "mono",
					value: g.override.term,
					onChange: (e) => {
						const v = e.target.value;
						upd((x) => {
							x.override.term = v;
						});
					}
				})]
			}), /* @__PURE__ */ jsxs("label", {
				className: "field",
				children: [/* @__PURE__ */ jsx("span", { children: t$3("ui.final_rating_26f0fa") }), /* @__PURE__ */ jsx("input", {
					className: "mono",
					value: g.override.final,
					onChange: (e) => {
						const v = e.target.value;
						upd((x) => {
							x.override.final = v;
						});
					}
				})]
			})]
		})
	] });
}
//#endregion
//#region src/views/builder2/FormPaper.jsx
const html = (t) => ({ __html: renderMarkup(t) });
function FormPaper({ d, model, preparedBy }) {
	const selected = model.outcomesReady(d);
	const I = selected ? model.institutionFor(d) : {
		vision: "",
		mission: {
			lead: "",
			items: []
		}
	};
	const egas = selected ? model.egaList(d) : [];
	const pos = selected ? model.poList(d) : [];
	const f = model.formulas(d);
	const cloTags = (c) => {
		const e = c.egas.join("&");
		const po = c.pos.join(", ");
		return (e ? "[EGA " + e + "] " : "") + (po ? "[PO " + po + "]" : "");
	};
	const iloTags = (il) => il.tags.map((t) => {
		const i = model.tagInfo(d, t);
		return i.kind === "clo" ? "[CLO" + i.no + "]" : "[" + i.label.replace(" ", "") + "]";
	}).join(" ");
	return /* @__PURE__ */ jsxs("div", {
		className: "paper",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "paper-head",
				children: [
					/* @__PURE__ */ jsx("img", {
						className: "paper-logo",
						src: "/lcup-logo.png",
						alt: "LCUP logo"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "c",
						children: [
							/* @__PURE__ */ jsx("b", {
								style: { fontSize: 14 },
								children: INSTITUTION_NAME
							}),
							/* @__PURE__ */ jsx("br", {}),
							INSTITUTION_ADDRESS
						]
					}),
					/* @__PURE__ */ jsx("img", {
						className: "paper-logo paper-logo-wide",
						src: "/testmark-logo.png",
						alt: "Testmark logo"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "c",
				style: { marginTop: 8 },
				children: [
					/* @__PURE__ */ jsx("b", { children: "SCHOOL YEAR " + CURRENT_SCHOOL_YEAR.label }),
					/* @__PURE__ */ jsx("br", {}),
					/* @__PURE__ */ jsx("b", { children: COLLEGE_NAME.toUpperCase() })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "I." }),
					/* @__PURE__ */ jsx("b", { children: "COURSE CODE" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", { children: d.meta.code })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "II." }),
					/* @__PURE__ */ jsx("b", { children: "COURSE TITLE" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("b", { children: d.meta.title })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "III." }),
					/* @__PURE__ */ jsx("b", { children: "COURSE DESCRIPTION" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			d.description.filter((x) => x.t.trim()).map((x) => /* @__PURE__ */ jsx("p", {
				className: "typed-text",
				style: {
					margin: "4px 0 4px 34px",
					textAlign: "justify"
				},
				children: x.t
			}, x.id)),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "IV." }),
					/* @__PURE__ */ jsx("b", { children: "PRE-REQUISITE" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", { children: d.meta.prereq })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "V." }),
					/* @__PURE__ */ jsx("b", { children: "CREDIT UNITS" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", { children: d.meta.lecture + " units lecture / " + d.meta.lab + " unit laboratory" })
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "VI." }),
					/* @__PURE__ */ jsx("b", { children: "COURSE LEARNING OUTCOMES:" }),
					/* @__PURE__ */ jsx("span", {}),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			/* @__PURE__ */ jsx("table", { children: /* @__PURE__ */ jsxs("tbody", { children: [/* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("th", {
				style: { width: "40%" },
				children: "Vision"
			}), /* @__PURE__ */ jsx("th", { children: "Mission" })] }), /* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("td", { children: I.vision }), /* @__PURE__ */ jsxs("td", { children: [I.mission.lead, /* @__PURE__ */ jsx("ul", { children: I.mission.items.map((t, k) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("i", { children: t }) }, k)) })] })] })] }) }),
			/* @__PURE__ */ jsx("table", { children: /* @__PURE__ */ jsxs("tbody", { children: [/* @__PURE__ */ jsxs("tr", { children: [
				/* @__PURE__ */ jsx("th", {
					style: { width: "22%" },
					children: "EXPECTED GRADUATE ATTRIBUTES"
				}),
				/* @__PURE__ */ jsx("th", {
					style: { width: "36%" },
					children: "PROGRAM OUTCOMES"
				}),
				/* @__PURE__ */ jsx("th", { children: "COURSE LEARNING OUTCOMES" })
			] }), /* @__PURE__ */ jsxs("tr", { children: [
				/* @__PURE__ */ jsx("td", { children: egas.map((e) => /* @__PURE__ */ jsxs("p", {
					style: { margin: "0 0 6px" },
					children: [/* @__PURE__ */ jsx("b", { children: "EGA " + e.no }), ": " + e.name]
				}, e.no)) }),
				/* @__PURE__ */ jsx("td", { children: pos.length ? pos.map((o) => /* @__PURE__ */ jsxs("p", {
					style: { margin: "0 0 4px" },
					children: [
						/* @__PURE__ */ jsx("b", { children: "PO " + o.no + "." }),
						" " + o.text + " ",
						/* @__PURE__ */ jsx("b", { children: o.egas.map((g) => "[EGA " + g + "]").join(" ") })
					]
				}, o.no)) : /* @__PURE__ */ jsx("span", {
					className: "m",
					children: "No program outcomes loaded."
				}) }),
				/* @__PURE__ */ jsx("td", { children: d.clos.map((c, i) => /* @__PURE__ */ jsxs("p", {
					style: { margin: "0 0 8px" },
					children: [
						/* @__PURE__ */ jsx("b", { children: "CLO " + (i + 1) + " – " + c.level + (c.title ? " (" + c.title + ")" : "") }),
						/* @__PURE__ */ jsx("br", {}),
						c.statement + " ",
						/* @__PURE__ */ jsx("b", { children: cloTags(c) })
					]
				}, c.id)) })
			] })] }) }),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "VII." }),
					/* @__PURE__ */ jsx("b", { children: "LEARNING PLAN:" }),
					/* @__PURE__ */ jsx("span", {}),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			/* @__PURE__ */ jsxs("table", { children: [/* @__PURE__ */ jsxs("colgroup", { children: [
				/* @__PURE__ */ jsx("col", { style: { width: "12%" } }),
				/* @__PURE__ */ jsx("col", { style: { width: "22%" } }),
				/* @__PURE__ */ jsx("col", { style: { width: "15%" } }),
				/* @__PURE__ */ jsx("col", { style: { width: "18%" } }),
				/* @__PURE__ */ jsx("col", { style: { width: "17%" } }),
				/* @__PURE__ */ jsx("col", {})
			] }), /* @__PURE__ */ jsxs("tbody", { children: [/* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsx("th", { children: "SCHEDULE" }), Object.values(PLAN_HEADINGS).map((h) => /* @__PURE__ */ jsx("th", { children: h.toUpperCase() }, h))] }), d.plan.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
				/* @__PURE__ */ jsx("td", { children: "Week " + r.week }),
				/* @__PURE__ */ jsx("td", { children: r.kind === "exam" ? /* @__PURE__ */ jsx("div", {
					className: "typed-text",
					children: r.ilos[0] ? r.ilos[0].text : ""
				}) : r.ilos.map((il, j) => /* @__PURE__ */ jsxs("div", {
					className: "typed-text",
					style: { marginBottom: 4 },
					children: [
						/* @__PURE__ */ jsx("b", { children: "ILO" + (j + 1) + ": " }),
						il.text + " ",
						/* @__PURE__ */ jsx("b", { children: iloTags(il) })
					]
				}, il.id)) }),
				/* @__PURE__ */ jsx("td", { dangerouslySetInnerHTML: html(r.contents) }),
				/* @__PURE__ */ jsx("td", { dangerouslySetInnerHTML: html(r.activities) }),
				/* @__PURE__ */ jsx("td", { dangerouslySetInnerHTML: html(r.tasks) }),
				/* @__PURE__ */ jsx("td", { dangerouslySetInnerHTML: html(r.values) })
			] }, r.id))] })] }),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "VIII." }),
					/* @__PURE__ */ jsx("b", { children: "COURSE REQUIREMENTS" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			/* @__PURE__ */ jsx("ol", {
				style: {
					margin: "2px 0 2px 34px",
					paddingLeft: 18
				},
				children: d.reqs.filter((r) => r.t.trim()).map((r) => /* @__PURE__ */ jsx("li", { children: r.t }, r.id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				children: [
					/* @__PURE__ */ jsx("b", { children: "IX." }),
					/* @__PURE__ */ jsx("b", { children: "REFERENCES" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			GROUPS.map(([key, title], gi) => {
				const grp = d.refs[key];
				return /* @__PURE__ */ jsxs("div", {
					style: { marginLeft: 34 },
					children: [/* @__PURE__ */ jsx("b", { children: String.fromCharCode(65 + gi) + ". " + title.toUpperCase() }), grp.na ? /* @__PURE__ */ jsx("div", {
						className: "m",
						children: "Not applicable."
					}) : grp.items.filter((r) => r.t.trim()).map((r) => /* @__PURE__ */ jsx("div", {
						style: { margin: "2px 0" },
						children: r.t
					}, r.id))]
				}, key);
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "kv2",
				style: { marginTop: 10 },
				children: [
					/* @__PURE__ */ jsx("b", { children: "X." }),
					/* @__PURE__ */ jsx("b", { children: "GRADING SYSTEM" }),
					/* @__PURE__ */ jsx("span", { children: ":" }),
					/* @__PURE__ */ jsx("span", {})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: { marginLeft: 34 },
				children: [
					d.grading.rows.map((r, i) => /* @__PURE__ */ jsx("div", { children: i + 1 + ". " + r.label + "  " + (Number(r.pct) || 0) + "%" }, r.id)),
					/* @__PURE__ */ jsx("div", { children: f.term.replace("Term Grade = ", "Term Grade: ") }),
					/* @__PURE__ */ jsx("div", { children: f.final.replace("Final Rating = ", "Final Rating: ") })
				]
			}),
			/* @__PURE__ */ jsx("table", {
				style: { marginTop: 14 },
				children: /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsxs("td", { children: [
						"Prepared by:",
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("b", { children: preparedBy })
					] }),
					/* @__PURE__ */ jsxs("td", { children: [
						"Checked and Reviewed by:",
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("b", {
							className: "m",
							children: "Added by the system on review"
						})
					] }),
					/* @__PURE__ */ jsxs("td", { children: [
						"Approved by:",
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsx("b", {
							className: "m",
							children: "Added by the system on approval"
						})
					] })
				] }) })
			})
		]
	});
}
//#endregion
//#region src/lib/complianceView.js
const SOURCE_LABEL = {
	rule: "Rule",
	ai: "AI"
};
const STEP_INFO = {
	info: {
		n: 1,
		title: "Course Information"
	},
	clos: {
		n: 2,
		title: "Learning Outcomes"
	},
	plan: {
		n: 3,
		title: "Learning Plan"
	},
	reqs: {
		n: 4,
		title: "Course Requirements"
	},
	refs: {
		n: 5,
		title: "References"
	},
	grade: {
		n: 6,
		title: "Grading System"
	},
	review: {
		n: 7,
		title: "Review & Check"
	}
};
const stepLabel = (key) => STEP_INFO[key] ? "Step " + STEP_INFO[key].n + ": " + STEP_INFO[key].title : "";
function runState(run) {
	if (!run) return "none";
	if (run.status === "incomplete" || run.hybrid && !run.hybrid.ready && !run.hybrid.critical) return "incomplete";
	return run.status === "insufficient" || run.overall === null || run.overall === void 0 ? "insufficient" : "scored";
}
function tone$1(score, passThreshold) {
	if (score === null || score === void 0) return "none";
	return score >= passThreshold ? "good" : "warn";
}
const ringAngle = (score) => Math.max(0, Math.min(100, Number(score) || 0)) * 3.6 + "deg";
function basis(run) {
	if (!run) return {
		kind: "none",
		label: "",
		note: ""
	};
	if (run.aiStatus === "pending") return {
		kind: "pending",
		label: "Rule-based check",
		note: "The rule check is done. Recommendations are still being written."
	};
	if (run.aiStatus === "failed") {
		const judged = (run.hybrid?.alignment?.judgements || []).filter((j) => !j.unverified && j.label !== "INSUFFICIENT_EVIDENCE").length;
		const total = (run.hybrid?.alignment?.judgements || []).length;
		if (judged > 0) return {
			kind: "stale",
			label: "AI check incomplete",
			note: judged + " of " + total + " relationships were checked by the AI. Click Re-check to finish the rest."
		};
		return {
			kind: "unavailable",
			label: "AI unavailable",
			note: "AI suggestions are not available right now, so these recommendations come from the rules."
		};
	}
	if (run.aiStatus === "ok") return {
		kind: "ai",
		label: "AI-assisted check",
		note: ""
	};
	return {
		kind: "rule",
		label: "Rule-based check",
		note: ""
	};
}
const blockersOf = (run, gate = "required") => gate === "advisory" ? hardGatesOf(run) : run && run.findings ? run.findings.filter((f) => f.severity === "blocking") : [];
const warningsOf = (run) => run && run.findings ? run.findings.filter((f) => f.severity !== "blocking") : [];
const warningCount = (run) => run && !run.stale ? warningsOf(run).length : 0;
function headline(run) {
	const st = runState(run);
	if (st === "none") return "Not checked yet.";
	if (st === "incomplete") return "Verification incomplete. No final AI score is available.";
	if (st === "insufficient") return "Not enough written yet to give a score. Fill in more of the form.";
	const blockers = blockersOf(run).length;
	if (blockers) return blockers + " " + (blockers === 1 ? "problem stops" : "problems stop") + " this syllabus from being submitted.";
	return run.overall >= run.passThreshold ? "Meets the standard (pass line " + run.passThreshold + "%)." : "Below the pass line of " + run.passThreshold + "%. You can still submit; the reviewer will see this score.";
}
function areaNames(run, rec) {
	const names = new Map((run.areas || []).map((a) => [a.key, a.name]));
	return (rec.areas || []).map((k) => names.get(k) || k);
}
function groupFindings(run) {
	const by = /* @__PURE__ */ new Map();
	(run.findings || []).forEach((f) => {
		(by.get(f.area) || by.set(f.area, []).get(f.area)).push(f);
	});
	return (run.areas || []).filter((a) => by.has(a.key)).map((a) => ({
		key: a.key,
		name: a.name,
		findings: by.get(a.key)
	}));
}
const when = (createdAt) => phDate(createdAt);
function provisionalOf(run) {
	if (!run || runState(run) !== "incomplete") return null;
	const h = run.hybrid;
	if (!h || h.critical || !Number.isFinite(h.provisionalScore)) return null;
	const c = h.alignment && h.alignment.coverage;
	if (!c || !c.verified || c.total && c.verified / c.total < .5) return null;
	const { verified, total } = c;
	return {
		score: h.provisionalScore,
		verified,
		total,
		rule: h.summary ? h.summary.status === "mandatory_open" : false
	};
}
function verdictOf(run) {
	const v = run && run.hybrid && run.hybrid.verdict;
	return v && !v.unavailable && v.overall ? v : null;
}
const VERDICT_ORDER = {
	FAIL: 0,
	NEEDS_REVIEW: 1,
	NOT_CHECKED: 2,
	NOT_APPLICABLE: 3,
	PASS: 4
};
const SEVERITY_ORDER = {
	CRITICAL: 0,
	MAJOR: 1,
	MINOR: 2,
	INFO: 3
};
function verdictIssues(v) {
	return (v && v.findings || []).filter((f) => f.status === "FAIL" || f.status === "NEEDS_REVIEW" && f.severity !== "INFO" || f.explanationReview?.length || f.draftReview?.length || f.draftWarnings?.length).sort((a, b) => VERDICT_ORDER[a.status] - VERDICT_ORDER[b.status] || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
//#endregion
//#region src/lib/panelMemory.js
const KEEP = 20;
const memory = /* @__PURE__ */ new Map();
function memoryOf(runId) {
	if (!memory.has(runId)) {
		memory.set(runId, {
			edits: {},
			refined: {},
			running: /* @__PURE__ */ new Map()
		});
		while (memory.size > KEEP) memory.delete(memory.keys().next().value);
	}
	return memory.get(runId);
}
//#endregion
//#region src/lib/checkPolicy.js
let known = null;
function useAiGate() {
	const [gate, setGate] = useState(known || "required");
	useEffect(() => {
		if (known) return void 0;
		let live = true;
		syllabusCheck.status().then((s) => {
			known = s && s.aiGate === "advisory" ? "advisory" : "required";
			if (live) setGate(known);
		}).catch(() => {});
		return () => {
			live = false;
		};
	}, []);
	return gate;
}
//#endregion
//#region src/lib/hybridView.js
const SEVERITY_OF_LABEL = {
	NOT_ALIGNED: "high",
	INSUFFICIENT_EVIDENCE: "high",
	PARTIALLY_ALIGNED: "medium"
};
function problemsOf(hybrid, run) {
	if (!hybrid) return [];
	const out = [];
	if (hybrid.critical) {
		const f = run?.findings?.find((x) => x.ruleId === "CUR-CODE");
		if (f?.message) out.push({
			id: "critical",
			key: "CUR-CODE",
			kind: "critical",
			severity: "high",
			title: f.message
		});
	}
	const aligned = /* @__PURE__ */ new Map();
	const advisoryTypes = /* @__PURE__ */ new Set(["REF-plan", ...hybrid.policy?.advisoryTypes || []]);
	for (const j of hybrid.alignment?.judgements || []) {
		if (j.unverified && String(j.failureKind || "").startsWith("provider_")) continue;
		const advisory = advisoryTypes.has(j.type);
		const severity = advisory ? j.label === "ALIGNED" ? void 0 : "medium" : SEVERITY_OF_LABEL[j.label];
		if (!severity) continue;
		const p = {
			id: "alignment:" + j.id,
			key: "SEM:" + j.id,
			kind: "alignment",
			severity,
			label: j.label,
			type: j.type,
			advisory,
			where: j.type === "REF-plan" ? void 0 : j.path,
			title: j.type === "REF-plan" ? String(j.path || "").replace(/^refs:/, "") : String(j.type || "").replaceAll("_", " "),
			detail: j.explanation,
			sourceQuote: j.sourceQuote,
			targetQuote: j.targetQuote
		};
		aligned.set(p.key, p);
		out.push(p);
	}
	for (const d of hybrid.deductions || []) {
		const same = aligned.get(d.id);
		if (same) {
			same.points = d.points;
			continue;
		}
		out.push({
			id: "deduction:" + d.id,
			key: d.id,
			kind: "deduction",
			severity: "high",
			title: d.reason,
			points: d.points,
			ref: d.id
		});
	}
	return out.sort((a, b) => a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1);
}
function linkProblems(problems, suggestions) {
	const fixed = /* @__PURE__ */ new Set();
	const forSuggestion = {};
	for (const s of suggestions || []) {
		const ids = /* @__PURE__ */ new Set([s.id, ...s.basedOn || []]);
		forSuggestion[s.id] = problems.filter((p) => ids.has(p.key));
		forSuggestion[s.id].forEach((p) => fixed.add(p.id));
	}
	return {
		forSuggestion,
		unlinked: problems.filter((p) => !fixed.has(p.id))
	};
}
function suggestionKind(path) {
	const p = String(path || "");
	if (/^clos\[/.test(p)) return "clo";
	if (/\.ilos\[/.test(p)) return "ilo";
	if (/^plan\[/.test(p)) return "plan";
	if (/^outcomes\./.test(p)) return "outcomes";
	if (/^meta\./.test(p)) return "meta";
	return "other";
}
const canRefine = (s) => !!s && s.source === "ai" && typeof s.replacement === "string" && /^(?:clos\[\d+\]\.statement|plan\[\d+\]\.(?:values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/.test(String(s.path));
//#endregion
//#region src/components/HybridProblem.jsx
function HybridProblem({ p }) {
	return /* @__PURE__ */ jsxs("li", {
		className: "hy-problem",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "hy-problem-head",
				children: [
					/* @__PURE__ */ jsx("strong", { children: p.title }),
					p.label && /* @__PURE__ */ jsx("span", {
						className: "hy-pill " + (p.severity === "high" ? "bad" : "warn"),
						children: t$3(`hybrid.label.${p.label}`)
					}),
					p.advisory && /* @__PURE__ */ jsx("span", {
						className: "hy-pill quiet",
						children: t$3("hybrid.advisory")
					}),
					p.points > 0 && /* @__PURE__ */ jsx("span", {
						className: "hy-pill bad",
						children: t$3("hybrid.pts", { points: p.points })
					}),
					p.where && /* @__PURE__ */ jsx("span", {
						className: "hy-pill quiet",
						children: t$3("hybrid.where", { where: p.where })
					})
				]
			}),
			p.detail && /* @__PURE__ */ jsx("p", { children: p.detail }),
			(p.sourceQuote || p.targetQuote) && /* @__PURE__ */ jsxs("div", {
				className: "hy-quotes",
				children: [p.sourceQuote && /* @__PURE__ */ jsxs("blockquote", { children: [/* @__PURE__ */ jsx("small", { children: t$3("hybrid.quoteSource") }), p.sourceQuote] }), p.targetQuote && /* @__PURE__ */ jsxs("blockquote", { children: [/* @__PURE__ */ jsx("small", { children: t$3("hybrid.quoteTarget") }), p.targetQuote] })]
			})
		]
	});
}
//#endregion
//#region src/components/HybridCheckPanel.jsx
const without = (map, key) => {
	const next = { ...map };
	delete next[key];
	return next;
};
function HybridCheckPanel({ run, onApplyDraft }) {
	const aiGate = useAiGate();
	const [edits, setEdits] = useState({});
	const [decisions, setDecisions] = useState({});
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState({});
	const [working, setWorking] = useState("");
	const [appliedValue, setAppliedValue] = useState({});
	const [decisionText, setDecisionText] = useState({});
	const [refining, setRefining] = useState("");
	const [refined, setRefined] = useState({});
	const [ready, setReady] = useState(false);
	const decisionLock = useRef(false);
	const hybrid = run?.hybrid;
	const keep = (field, set) => (update) => set((current) => {
		const next = typeof update === "function" ? update(current) : update;
		if (run?.id) memoryOf(run.id)[field] = next;
		return next;
	});
	const setEditsKept = keep("edits", setEdits);
	const setRefinedKept = keep("refined", setRefined);
	useEffect(() => {
		let live = true;
		const mem = run?.id ? memoryOf(run.id) : null;
		setDecisions({});
		setDecisionText({});
		setEdits(mem ? { ...mem.edits } : {});
		setAppliedValue({});
		setRefined(mem ? { ...mem.refined } : {});
		setRefining("");
		setError("");
		setErrors({});
		if (mem) for (const [id, promise] of mem.running) {
			setRefining(id);
			promise.then(() => {
				if (live) {
					setRefined({ ...mem.refined });
					setEdits({ ...mem.edits });
					setRefining("");
				}
			});
		}
		setReady(!(hybrid && run.id));
		if (hybrid && run.id) syllabusCheck.decisions(run.id).then((rows) => {
			if (!live) return;
			setDecisions(Object.fromEntries(rows.map((row) => [row.suggestionId, row.action])));
			setDecisionText(Object.fromEntries(rows.map((row) => [row.suggestionId, row.editedText])));
			setReady(true);
		}).catch((e) => {
			if (live) setError(e.message);
		});
		return () => {
			live = false;
		};
	}, [run?.id]);
	if (!hybrid) return null;
	const isHandled = (s) => decisions[s.id] === "accept" || decisions[s.id] === "edit";
	const appliedOf = (s) => appliedValue[s.id] ?? (decisions[s.id] === "edit" ? decisionText[s.id] : s.replacement);
	const canUndo = (s) => !!onApplyDraft && !s.originalMissing && Object.hasOwn(s, "originalValue");
	const pending = hybrid.suggestions.filter((s) => !isHandled(s));
	const handled = hybrid.suggestions.filter(isHandled);
	const decide = async (suggestion, action) => {
		if (decisionLock.current) return;
		decisionLock.current = true;
		setBusy(true);
		setWorking(suggestion.id);
		setError("");
		setErrors((current) => {
			const next = { ...current };
			delete next[suggestion.id];
			return next;
		});
		try {
			const recordDecision = (body) => syllabusCheck.decide(run.id, body);
			const id = suggestion.id;
			if (action === "reject" && isHandled(suggestion)) {
				await undoSuggestion({
					suggestion,
					appliedValue: appliedOf(suggestion),
					applyDraft: onApplyDraft,
					recordDecision
				});
				setAppliedValue((current) => {
					const next = { ...current };
					delete next[id];
					return next;
				});
				setEditsKept((current) => {
					const next = { ...current };
					delete next[id];
					return next;
				});
				setDecisions((current) => ({
					...current,
					[id]: "reject"
				}));
			} else {
				const result = await decideSuggestion({
					suggestion,
					action,
					editedText: edits[id],
					applyDraft: onApplyDraft,
					recordDecision
				});
				if (result.applied) setAppliedValue((current) => ({
					...current,
					[id]: action === "edit" ? edits[id] : suggestion.replacement
				}));
				setDecisionText((current) => ({
					...current,
					[id]: action === "edit" ? edits[id] : null
				}));
				setDecisions((current) => ({
					...current,
					[id]: result.decision.action
				}));
			}
		} catch (e) {
			const message = e.message?.startsWith("hybrid.") ? t$3(e.message) : e.message;
			const text = e.draftSaved ? t$3("hybrid.savedDecisionFailed", { message }) : message;
			setErrors((current) => ({
				...current,
				[suggestion.id]: text || t$3("hybrid.applyFailed")
			}));
		} finally {
			decisionLock.current = false;
			setBusy(false);
			setWorking("");
		}
	};
	const refine = async (suggestion) => {
		if (refining || decisionLock.current) return;
		const id = suggestion.id;
		setRefining(id);
		setErrors((current) => without(current, id));
		setRefinedKept((current) => without(current, id));
		const mem = memoryOf(run.id);
		const job = syllabusCheck.refine(run.id, id).then((out) => {
			mem.refined = {
				...mem.refined,
				[id]: out
			};
			if (out.status === "verified" && out.usedRewrite) mem.edits = {
				...mem.edits,
				[id]: out.text
			};
			return { out };
		}, (e) => ({ error: e })).then((done) => {
			mem.running.delete(id);
			return done;
		});
		mem.running.set(id, job);
		const { out, error } = await job;
		if (error) setErrors((current) => ({
			...current,
			[id]: error.message || t$3("hybrid.refineFailed")
		}));
		else {
			setRefined({ ...mem.refined });
			if (out.status === "verified" && out.usedRewrite) setEdits({ ...mem.edits });
		}
		setRefining("");
	};
	const notes = hybrid.quality?.findings || [];
	const summary = hybrid.summary;
	const unresolved = hybrid.unresolved || [];
	const regressed = (hybrid.corrections || []).filter((c) => c.status === "regressed");
	const maxAttempts = hybrid.policy?.maxRewriteAttempts ?? 2;
	const problems = problemsOf(hybrid, run);
	const hardGates = hardGatesOf(run);
	const { forSuggestion } = linkProblems(problems, hybrid.suggestions);
	const outOfCredits = !(hybrid.alignment.status === "completed") && /\b402\b|insufficient credits|more credits|out of credits|credit balance|quota/i.test(hybrid.alignment.reason || "");
	return /* @__PURE__ */ jsx("section", {
		className: "hy",
		"aria-label": t$3("hybrid.label"),
		children: /* @__PURE__ */ jsxs("div", {
			className: "hy-body",
			children: [
				outOfCredits && /* @__PURE__ */ jsxs("div", {
					className: "hy-lock",
					role: "alert",
					children: [/* @__PURE__ */ jsx("b", { children: t$3("hybrid.incomplete") }), /* @__PURE__ */ jsx("span", { children: hybrid.alignment.reason || t$3("hybrid.incompleteNote") })]
				}),
				aiGate === "advisory" ? hardGates.length > 0 ? outOfCredits && /* @__PURE__ */ jsxs("div", {
					className: "hy-lock",
					role: "alert",
					children: [
						/* @__PURE__ */ jsx("b", { children: t$3("hybrid.hardGateTitle") }),
						/* @__PURE__ */ jsx("span", { children: t$3("hybrid.hardGateText") }),
						/* @__PURE__ */ jsx("ul", { children: hardGates.map((f) => /* @__PURE__ */ jsx("li", { children: f.message }, f.id)) })
					]
				}) : /* @__PURE__ */ jsxs("div", {
					className: "hy-advice",
					role: "note",
					children: [/* @__PURE__ */ jsx("b", { children: t$3("hybrid.adviceTitle") }), /* @__PURE__ */ jsx("span", { children: t$3("hybrid.adviceText") })]
				}) : !hybrid.ready && outOfCredits && /* @__PURE__ */ jsxs("div", {
					className: "hy-lock",
					role: "alert",
					children: [/* @__PURE__ */ jsx("b", { children: t$3("hybrid.lockedTitle") }), /* @__PURE__ */ jsx("span", { children: t$3("hybrid.locked") })]
				}),
				error && /* @__PURE__ */ jsx("div", {
					role: "alert",
					className: "info-banner warning",
					children: error
				}),
				summary && /* @__PURE__ */ jsxs("div", {
					className: "hy-summary " + summary.status,
					role: "status",
					children: [
						/* @__PURE__ */ jsx("b", { children: t$3(`hybrid.summary.${summary.status}`, { count: summary.counts.material }) }),
						summary.status === "no_changes_needed" && summary.counts.optional > 0 && /* @__PURE__ */ jsx("span", { children: t$3("hybrid.summary.optionalAvailable", { count: summary.counts.optional }) }),
						regressed.map((c) => /* @__PURE__ */ jsx("span", { children: t$3("hybrid.regressedNote", { path: c.path }) }, c.path))
					]
				}),
				hybrid.suggestions.length > 0 && /* @__PURE__ */ jsxs("details", {
					className: "hy-recs",
					open: true,
					children: [/* @__PURE__ */ jsx("summary", { children: /* @__PURE__ */ jsx("h4", { children: t$3(pending.length === 1 ? "hybrid.recommendation" : "hybrid.recommendations", { count: pending.length }) }) }), /* @__PURE__ */ jsxs("div", {
						className: "hy-box",
						children: [
							pending.length > 0 && /* @__PURE__ */ jsx("p", {
								className: "hy-note",
								children: onApplyDraft ? t$3("hybrid.applyNote") : t$3("hybrid.readOnlyNote")
							}),
							pending.length === 0 && /* @__PURE__ */ jsx("div", {
								className: "hy-clear",
								role: "status",
								children: t$3("hybrid.allHandled")
							}),
							pending.map((s) => {
								const stale = !!onApplyDraft && !Object.hasOwn(s, "originalValue");
								const decided = decisions[s.id];
								const shown = edits[s.id] ?? s.replacement;
								const canEdit = !!edits[s.id]?.trim();
								const rw = refined[s.id];
								const useRewrite = !!rw && rw.status === "verified" && rw.usedRewrite && edits[s.id] === rw.text;
								const checkable = !!onApplyDraft && canRefine(s) && !stale;
								return /* @__PURE__ */ jsxs("article", {
									className: "hy-rec" + (decided ? " decided " + decided : ""),
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "hy-rec-head",
											children: [
												/* @__PURE__ */ jsx("strong", { children: s.title }),
												/* @__PURE__ */ jsx("span", {
													className: "hy-pill quiet",
													children: t$3(`hybrid.kind.${suggestionKind(s.path)}`)
												}),
												/* @__PURE__ */ jsx("span", {
													className: "hy-pill quiet",
													children: s.path
												}),
												s.tier && /* @__PURE__ */ jsx("span", {
													className: "hy-pill tier " + s.tier,
													children: t$3(`hybrid.tier.${s.tier}`)
												}),
												s.attempt > 1 && /* @__PURE__ */ jsx("span", {
													className: "hy-pill warn",
													children: t$3("hybrid.attempt", {
														n: s.attempt,
														max: maxAttempts
													})
												}),
												s.source && /* @__PURE__ */ jsx("span", {
													className: "hy-pill src",
													children: s.source
												}),
												decided && /* @__PURE__ */ jsx("span", {
													className: "hy-pill quiet",
													role: "status",
													children: onApplyDraft ? t$3(`hybrid.decision.${decided}`) : t$3("hybrid.rejectedByAuthor")
												})
											]
										}),
										forSuggestion[s.id]?.length > 0 && /* @__PURE__ */ jsxs("details", {
											className: "hy-fixes",
											open: true,
											children: [/* @__PURE__ */ jsx("summary", { children: t$3("hybrid.fixes", { count: forSuggestion[s.id].length }) }), /* @__PURE__ */ jsx("ul", { children: forSuggestion[s.id].map((p) => /* @__PURE__ */ jsx(HybridProblem, { p }, p.id)) })]
										}),
										typeof s.replacement !== "string" && /* @__PURE__ */ jsx("p", {
											className: "hy-why",
											children: s.text
										}),
										typeof s.replacement === "string" && (onApplyDraft ? /* @__PURE__ */ jsxs("label", {
											className: "hy-edit",
											children: [/* @__PURE__ */ jsx("span", { children: t$3("hybrid.editText") }), /* @__PURE__ */ jsx("textarea", {
												"aria-label": t$3("hybrid.editLabel", { id: s.id }),
												rows: 3,
												maxLength: 1e4,
												value: shown,
												onChange: (e) => {
													const text = e.target.value;
													setEditsKept((current) => ({
														...current,
														[s.id]: text
													}));
													setRefined((current) => current[s.id] && current[s.id].text !== text ? without(current, s.id) : current);
												}
											})]
										}) : /* @__PURE__ */ jsxs("div", {
											className: "hy-suggested",
											children: [/* @__PURE__ */ jsx("span", { children: t$3("hybrid.suggestedText") }), /* @__PURE__ */ jsx("p", { children: s.replacement })]
										})),
										stale && /* @__PURE__ */ jsx("p", {
											className: "hy-hint",
											role: "note",
											children: t$3("hybrid.cardStale")
										}),
										errors[s.id] && /* @__PURE__ */ jsx("div", {
											className: "hy-err",
											role: "alert",
											children: errors[s.id]
										}),
										rw && /* @__PURE__ */ jsxs("div", {
											className: "hy-verify " + rw.status,
											role: "status",
											children: [
												rw.reason === "no_meaningful_change" && /* @__PURE__ */ jsx("p", { children: t$3("hybrid.refineNoChange") }),
												/* @__PURE__ */ jsx("p", { children: t$3(rw.status === "blocked" ? "hybrid.refineBlocked" : rw.usedRewrite ? "hybrid.refineRewritten" : "hybrid.refineOk", {
													checked: rw.stats.checked,
													improved: rw.stats.improved,
													worse: rw.stats.worse
												}) }),
												rw.status === "blocked" && rw.blockers.length > 0 && /* @__PURE__ */ jsxs("details", { children: [/* @__PURE__ */ jsx("summary", { children: t$3("hybrid.refineBlockers") }), /* @__PURE__ */ jsx("ul", { children: rw.blockers.map((b) => /* @__PURE__ */ jsxs("li", { children: [
													/* @__PURE__ */ jsx("strong", { children: b.type }),
													" ",
													t$3("hybrid.label." + b.from),
													" → ",
													t$3("hybrid.label." + b.to),
													b.why ? " · " + b.why : ""
												] }, b.id)) })] })
											]
										}),
										onApplyDraft && /* @__PURE__ */ jsxs("div", {
											className: "hy-actions",
											children: [
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "btn primary",
													disabled: busy || stale || !ready || refining === s.id,
													onClick: () => decide(s, useRewrite ? "edit" : "accept"),
													children: working === s.id ? t$3("hybrid.applying") : t$3(useRewrite ? "hybrid.applyVerified" : "hybrid.accept")
												}),
												typeof s.replacement === "string" && /* @__PURE__ */ jsx("button", {
													type: "button",
													className: "btn outline",
													disabled: busy || stale || !ready || !canEdit || refining === s.id,
													onClick: () => decide(s, "edit"),
													children: t$3("hybrid.editApply")
												}),
												checkable && /* @__PURE__ */ jsx("button", {
													type: "button",
													className: "btn outline",
													disabled: busy || !!refining || !ready,
													onClick: () => refine(s),
													children: refining === s.id ? t$3("hybrid.refining") : t$3("hybrid.refine")
												}),
												/* @__PURE__ */ jsx("button", {
													type: "button",
													className: "btn ghost",
													disabled: busy || !ready,
													onClick: () => decide(s, "reject"),
													children: t$3("hybrid.reject")
												})
											]
										})
									]
								}, s.id);
							}),
							handled.length > 0 && /* @__PURE__ */ jsxs("details", {
								className: "hy-handled",
								children: [/* @__PURE__ */ jsx("summary", { children: t$3("hybrid.handled", { count: handled.length }) }), /* @__PURE__ */ jsx("ul", { children: handled.map((s) => /* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsxs("div", {
									className: "hy-rec-head",
									children: [
										/* @__PURE__ */ jsx("strong", { children: s.title }),
										/* @__PURE__ */ jsx("span", {
											className: "hy-pill quiet",
											children: t$3(`hybrid.kind.${suggestionKind(s.path)}`)
										}),
										/* @__PURE__ */ jsx("span", {
											className: "hy-pill good",
											role: "status",
											children: onApplyDraft ? t$3("hybrid.appliedSaved") : t$3("hybrid.appliedByAuthor")
										}),
										canUndo(s) && /* @__PURE__ */ jsx("button", {
											type: "button",
											className: "btn ghost",
											disabled: busy,
											onClick: () => decide(s, "reject"),
											children: working === s.id ? t$3("hybrid.applying") : t$3("hybrid.undo")
										})
									]
								}), errors[s.id] && /* @__PURE__ */ jsx("div", {
									className: "hy-err",
									role: "alert",
									children: errors[s.id]
								})] }, s.id)) })]
							})
						]
					})]
				}),
				unresolved.length > 0 && /* @__PURE__ */ jsxs("details", {
					className: "hy-recs hy-unresolved",
					open: true,
					children: [/* @__PURE__ */ jsx("summary", { children: /* @__PURE__ */ jsx("h4", { children: t$3("hybrid.unresolvedTitle", { count: unresolved.length }) }) }), /* @__PURE__ */ jsxs("div", {
						className: "hy-box",
						children: [/* @__PURE__ */ jsx("p", {
							className: "hy-note",
							children: t$3("hybrid.unresolvedNote")
						}), /* @__PURE__ */ jsx("ul", { children: unresolved.map((u) => /* @__PURE__ */ jsxs("li", { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "hy-rec-head",
								children: [/* @__PURE__ */ jsx("strong", { children: u.path }), /* @__PURE__ */ jsx("span", {
									className: "hy-pill tier " + u.tier,
									children: t$3(`hybrid.tier.${u.tier}`)
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "hy-why",
								children: t$3(`hybrid.unresolved.${u.reason}`, {
									attempts: u.attempts,
									value: u.value
								})
							}),
							u.explanation && /* @__PURE__ */ jsx("p", {
								className: "hy-why",
								children: u.explanation
							})
						] }, u.path)) })]
					})]
				}),
				notes.length > 0 && /* @__PURE__ */ jsxs("details", {
					className: "hy-recs hy-quality",
					children: [/* @__PURE__ */ jsx("summary", { children: /* @__PURE__ */ jsx("h4", { children: t$3("hybrid.qualityTitle", { count: notes.length }) }) }), /* @__PURE__ */ jsxs("div", {
						className: "hy-box",
						children: [/* @__PURE__ */ jsx("p", {
							className: "hy-note",
							children: t$3("hybrid.qualityNote")
						}), /* @__PURE__ */ jsx("ul", { children: notes.map((n) => /* @__PURE__ */ jsxs("li", { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "hy-rec-head",
								children: [/* @__PURE__ */ jsx("strong", { children: n.message }), /* @__PURE__ */ jsx("span", {
									className: "hy-pill quiet",
									children: t$3(`hybrid.quality.${n.category}`)
								})]
							}),
							n.evidence[0] && /* @__PURE__ */ jsx("p", {
								className: "hy-why",
								children: /* @__PURE__ */ jsx("q", { children: n.evidence[0].quote })
							}),
							/* @__PURE__ */ jsx("p", {
								className: "hy-why",
								children: n.impact
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "hy-hint",
								children: [
									t$3("hybrid.qualityAction"),
									" ",
									n.action
								]
							})
						] }, n.id)) })]
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/components/VerdictPanel.jsx
const status = (s) => t$3(`verdict.status.${s}`);
const tone = (s) => s === "PASS" ? "ok" : s === "FAIL" ? "bad" : "warn";
function VerdictPanel({ run }) {
	const v = verdictOf(run);
	if (!v) return null;
	const issues = verdictIssues(v);
	const pct = v.completeness && Number.isFinite(v.completeness.percent) ? `${Math.round(v.completeness.percent)}%` : t$3("verdict.completenessNone");
	return /* @__PURE__ */ jsxs("section", {
		className: "vd",
		"aria-label": t$3("verdict.title"),
		children: [
			/* @__PURE__ */ jsx("h3", {
				className: "vd-title",
				children: t$3("verdict.title")
			}),
			/* @__PURE__ */ jsx("p", {
				className: "vd-note",
				children: t$3("verdict.note")
			}),
			run.hybrid.outcomeSource && /* @__PURE__ */ jsx("p", {
				className: "vd-note",
				children: t$3("verdict.outcomeSource", { source: run.hybrid.outcomeSource })
			}),
			/* @__PURE__ */ jsxs("dl", {
				className: "vd-grid",
				children: [
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.completeness") }), /* @__PURE__ */ jsx("dd", { children: pct })] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.curriculum") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${tone(v.curriculum)}`,
						children: status(v.curriculum)
					}) })] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.alignment") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${tone(v.alignment)}`,
						children: status(v.alignment)
					}) })] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.overall") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${v.overall === "COMPLIANT" ? "ok" : v.overall === "NOT_COMPLIANT" ? "bad" : "warn"}`,
						children: t$3(`verdict.overall.${v.overall}`)
					}) })] })
				]
			}),
			v.states && /* @__PURE__ */ jsxs("dl", {
				className: "vd-grid",
				"aria-label": t$3("verdict.states.title"),
				children: [
					v.states.identity && /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.states.identity") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${v.states.identity.status === "verified" ? "ok" : "bad"}`,
						children: t$3(`verdict.identity.${v.states.identity.status}`)
					}) })] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.states.structure") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${tone(v.states.structure)}`,
						children: status(v.states.structure)
					}) })] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3("verdict.states.values") }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${tone(v.states.values)}`,
						children: status(v.states.values)
					}) })] }),
					v.states.references && [
						"format",
						"relevance",
						"authenticity"
					].map((k) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t$3(`verdict.states.references.${k}`) }), /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("span", {
						className: `hy-pill vd-${tone(v.states.references[k])}`,
						children: status(v.states.references[k])
					}) })] }, k))
				]
			}),
			v.states && v.states.identity && v.states.identity.elsewhere.length > 0 && /* @__PURE__ */ jsx("p", {
				className: "vd-note",
				children: t$3("verdict.identity.elsewhere", { where: v.states.identity.elsewhere.map((x) => `${x.program} ${x.curriculumYear}`).join(", ") })
			}),
			Array.isArray(v.informational) && v.informational.map((i, k) => /* @__PURE__ */ jsx("p", {
				className: "vd-note",
				children: t$3("verdict.titleFormat", {
					entered: i.entered,
					approved: i.approved
				})
			}, k)),
			v.unverified && v.unverified.length > 0 && /* @__PURE__ */ jsx("p", {
				className: "vd-note",
				children: t$3("verdict.partial", { count: v.unverified.length })
			}),
			issues.length > 0 && /* @__PURE__ */ jsxs("details", {
				className: "vd-issues",
				open: true,
				children: [
					/* @__PURE__ */ jsxs("summary", { children: [
						t$3("verdict.issues"),
						" (",
						issues.length,
						")"
					] }),
					/* @__PURE__ */ jsx("ul", { children: issues.map((f, i) => /* @__PURE__ */ jsxs("li", { children: [
						/* @__PURE__ */ jsxs("div", {
							className: "vd-row",
							children: [
								/* @__PURE__ */ jsx("strong", { children: f.ruleId }),
								/* @__PURE__ */ jsx("span", {
									className: `hy-pill vd-${tone(f.status)}`,
									children: status(f.status)
								}),
								/* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.method.${f.method}`)
								}),
								f.verification && !(f.verification === "deterministic" && f.method === "deterministic") && f.verification !== "provisional_identity" && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.verification.${f.verification}`)
								}),
								f.week && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3("verdict.week", { week: f.week })
								}),
								f.responsible && f.status !== "PASS" && f.status !== "NOT_CHECKED" && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.responsible.${f.responsible}`)
								}),
								f.scope === "course" && f.clo && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3("verdict.scope.course")
								}),
								f.clo && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3("verdict.clo", { n: f.clo })
								}),
								f.coverageState && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.coverage.${f.coverageState}`)
								}),
								f.carriedBy && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.carriedBy.${f.carriedBy}`)
								}),
								f.authenticity && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.authenticity.${f.authenticity}`)
								}),
								f.definitions && f.definitions !== "configured" && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3(`verdict.definitions.${f.definitions}`)
								}),
								f.identityBasis === "provisional" && /* @__PURE__ */ jsx("span", {
									className: "hy-pill vd-warn",
									children: t$3("verdict.verification.provisional_identity")
								}),
								f.classification && f.classification.canonicalCoreValue && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3("verdict.coreValue", { value: f.classification.canonicalCoreValue })
								}),
								f.classification && f.classification.supportingValue && f.classification.supportingValue.length > 0 && /* @__PURE__ */ jsx("span", {
									className: "hy-pill",
									children: t$3("verdict.supportingValue", { values: f.classification.supportingValue.join(", ") })
								}),
								f.responseNote && /* @__PURE__ */ jsx("span", {
									className: "hy-pill vd-warn",
									children: t$3(`verdict.responseNote.${f.responseNote}`)
								})
							]
						}),
						f.issueMessages && f.issueMessages.length > 1 ? /* @__PURE__ */ jsx("p", { children: f.issueMessages.map((m) => tr(m)).join(" ") }) : f.explanation && /* @__PURE__ */ jsx("p", { children: tr(f.explanation) }),
						f.withheld && /* @__PURE__ */ jsxs("p", {
							className: "vd-note",
							children: [
								/* @__PURE__ */ jsxs("b", { children: [t$3("verdict.withheldTitle"), ":"] }),
								" ",
								t$3(`verdict.withheld.${f.withheld}`)
							]
						}),
						[
							[
								"explanation",
								"explanationReview",
								"explanation"
							],
							[
								"draft",
								"draftReview",
								"draft"
							],
							[
								"draftWarning",
								"draftWarnings",
								"draftWarnings"
							]
						].map(([kind, field, evidenceKind]) => {
							const codes = [...new Set(f[field] || [])];
							if (!codes.length) return null;
							return /* @__PURE__ */ jsxs("div", {
								className: "vd-note",
								children: [
									/* @__PURE__ */ jsx("b", { children: t$3(`verdict.review.${kind}Title`) }),
									/* @__PURE__ */ jsx("p", { children: t$3(`verdict.review.${kind}Note`) }),
									/* @__PURE__ */ jsx("ul", { children: codes.map((code) => {
										const evidence = (f.reviewEvidence?.[evidenceKind] || []).find((r) => r.code === code);
										const key = `verdict.review.code.${code}`, message = t$3(key);
										return /* @__PURE__ */ jsxs("li", { children: [message === key ? t$3("verdict.review.code.unknown") : message, evidence?.evidence && /* @__PURE__ */ jsxs(Fragment$1, { children: [" ", t$3("verdict.review.phrase", { phrase: evidence.evidence })] })] }, code);
									}) })
								]
							}, kind);
						}),
						f.supportingWeeks && (f.supportingWeeks.checked.length > 0 || f.supportingWeeks.cited.length > 0) && /* @__PURE__ */ jsx("p", {
							className: "vd-note",
							children: t$3("verdict.supportingWeeks", { weeks: [...f.supportingWeeks.checked, ...f.supportingWeeks.cited].join(", ") })
						}),
						f.gaps && /* @__PURE__ */ jsxs("p", {
							className: "vd-note",
							children: [
								/* @__PURE__ */ jsxs("b", { children: [t$3("verdict.gap"), ":"] }),
								" ",
								tr(f.gaps)
							]
						}),
						f.actual && /* @__PURE__ */ jsxs("p", {
							className: "vd-note",
							children: [
								/* @__PURE__ */ jsxs("b", { children: [t$3("verdict.original"), ":"] }),
								" ",
								f.actual
							]
						}),
						f.reference && /* @__PURE__ */ jsxs("p", {
							className: "vd-note",
							children: [
								/* @__PURE__ */ jsxs("b", { children: [t$3("verdict.reference"), ":"] }),
								" ",
								f.reference
							]
						}),
						!f.withheld && !f.draftReview?.length && f.recommendation && /* @__PURE__ */ jsxs("p", {
							className: "vd-note",
							children: [
								/* @__PURE__ */ jsxs("b", { children: [t$3("verdict.suggestion"), ":"] }),
								" ",
								tr(f.recommendation)
							]
						})
					] }, `${f.ruleId}:${f.path}:${i}`)) }),
					v.omitted > 0 && /* @__PURE__ */ jsx("p", {
						className: "vd-note",
						children: t$3("verdict.omitted", { count: v.omitted })
					})
				]
			})
		]
	});
}
//#endregion
//#region src/views/ComplianceCard.jsx
function ComplianceCard({ run, checking = false, onOpenStep, showFindings = true, onApplyDraft }) {
	const state = runState(run);
	const t = state === "scored" ? tone$1(run.overall, run.passThreshold) : "none";
	const how = basis(run);
	const provisional = provisionalOf(run);
	const aiGate = useAiGate();
	const blockers = blockersOf(run, aiGate);
	const recs = run && run.recommendations || [];
	const stepRef = (key) => {
		if (!STEP_INFO[key]) return null;
		return onOpenStep ? /* @__PURE__ */ jsx("button", {
			type: "button",
			className: "cmp-step",
			onClick: () => onOpenStep(key),
			children: tr(stepLabel(key))
		}) : /* @__PURE__ */ jsx("span", {
			className: "cmp-step plain",
			children: tr(stepLabel(key))
		});
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "cmp",
		children: [
			/* @__PURE__ */ jsx(HybridCheckPanel, {
				run,
				onApplyDraft
			}),
			/* @__PURE__ */ jsx(VerdictPanel, { run }),
			/* @__PURE__ */ jsxs("div", {
				className: "cmp-top",
				children: [checking ? /* @__PURE__ */ jsx("div", {
					className: "big-ring cmp-ring checking",
					style: { "--p": "0deg" },
					role: "img",
					"aria-label": t$3("ui.checking_your_syllabus_1278c5"),
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", {
						"aria-hidden": "true",
						children: "…"
					}), /* @__PURE__ */ jsx("small", { children: t$3("ui.checking_820d60") })] })
				}) : state === "scored" ? /* @__PURE__ */ jsx("div", {
					className: "big-ring cmp-ring " + t,
					style: { "--p": ringAngle(run.overall) },
					role: "img",
					"aria-label": t$3("ui.compliance_score_7a084d") + run.overall + t$3("ui.percent_c72154") + tr(run.band),
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("strong", { children: [run.overall, "%"] }), /* @__PURE__ */ jsx("small", { children: tr(run.band) })] })
				}) : provisional ? /* @__PURE__ */ jsx("div", {
					className: "big-ring cmp-ring provisional",
					style: { "--p": ringAngle(provisional.score) },
					role: "img",
					"aria-label": t$3("hybrid.provisionalAria", { score: provisional.score }),
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("strong", { children: [provisional.score, "%"] }), /* @__PURE__ */ jsx("small", { children: t$3("hybrid.provisional") })] })
				}) : /* @__PURE__ */ jsx("div", {
					className: "cmp-ring none",
					role: "img",
					"aria-label": t$3("ui.no_score_yet_3662ab"),
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: "—" }), /* @__PURE__ */ jsx("small", { children: state === "incomplete" ? t$3("hybrid.incomplete") : state === "insufficient" ? t$3("ui.not_enough_content_1c0e67") : t$3("ui.not_checked_22705e") })] })
				}), /* @__PURE__ */ jsxs("div", {
					className: "cmp-head",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "cmp-line",
							children: provisional ? t$3(provisional.rule ? "hybrid.provisionalRule" : provisional.total ? "hybrid.provisionalCoverage" : "hybrid.provisionalPlain", {
								verified: provisional.verified,
								total: provisional.total
							}) : aiGate === "advisory" && state === "incomplete" && blockers.length === 0 ? t$3("hybrid.advisoryIncomplete") : tr(headline(run))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "cmp-chips",
							children: [
								run?.hybrid && run.hybrid.alignment.status !== "completed" && /* @__PURE__ */ jsx("span", {
									className: "hy-pill warn",
									children: t$3("hybrid.alignment", { status: t$3(`hybrid.status.${run.hybrid.alignment.status}`) })
								}),
								run && how.label && /* @__PURE__ */ jsx("span", {
									className: "chip basis " + how.kind,
									children: tr(how.label)
								}),
								run && run.checkedBy === "admin" && /* @__PURE__ */ jsx("span", {
									className: "chip quiet",
									children: t$3("ui.checked_by_an_administrator_2cf77d")
								}),
								run && run.stale && /* @__PURE__ */ jsx("span", {
									className: "chip stale",
									children: t$3("ui.out_of_date_the_syllabus_changed_after_this_check_384297")
								}),
								run && /* @__PURE__ */ jsxs("span", {
									className: "chip quiet",
									children: [t$3("ui.standard_f00ef0") + run.standard, when(run.createdAt) ? t$3("ui.checked_e3b884") + when(run.createdAt) : ""]
								})
							]
						}),
						run && run.contact && run.contact.termHours !== null && run.contact.termHours !== void 0 && /* @__PURE__ */ jsx("p", {
							className: "cmp-small",
							children: t$3("ui.contact_hours_a41bbd") + run.contact.hoursPerWeek + t$3("ui.a_week_about_47d819") + run.contact.termHours + t$3("ui.for_the_term_the_plan_covers_825f4f") + run.contact.weeksPlanned + t$3("ui.of_607f2d") + run.contact.weeksExpected + t$3("ui.weeks_ff9807")
						})
					]
				})]
			}),
			run && /* @__PURE__ */ jsx("div", {
				className: "cmp-areas",
				children: run.areas.map((a) => {
					const at = a.score === null ? "none" : tone$1(a.score, run.passThreshold);
					return /* @__PURE__ */ jsxs("div", {
						className: "check-row",
						children: [
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: tr(a.name) }), /* @__PURE__ */ jsx("div", {
								className: "bar thin",
								children: /* @__PURE__ */ jsx("i", { style: { width: (a.score === null ? 0 : a.score) + "%" } })
							})] }),
							/* @__PURE__ */ jsx("b", { children: a.score === null ? "—" : a.score + "%" }),
							/* @__PURE__ */ jsx("span", {
								className: at === "good" ? "check-ok" : "check-warn",
								"aria-label": at === "good" ? t$3("ui.on_track_464e43") : at === "warn" ? t$3("ui.needs_work_def443") : t$3("ui.not_scored_4e720d"),
								children: at === "good" ? "✓" : at === "warn" ? "!" : "·"
							})
						]
					}, a.key);
				})
			}),
			blockers.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "cmp-block",
				role: "alert",
				children: [/* @__PURE__ */ jsx("b", { children: t$3("ui.these_stop_the_syllabus_from_being_submitted_cff5cf") }), /* @__PURE__ */ jsx("ul", { children: blockers.map((f) => /* @__PURE__ */ jsxs("li", { children: [
					tr(f.message),
					" ",
					stepRef(f.step)
				] }, f.id)) })]
			}),
			recs.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "cmp-recs",
				children: [
					/* @__PURE__ */ jsx("h4", { children: t$3("ui.recommendations_4faa65") }),
					how.note && /* @__PURE__ */ jsx("p", {
						className: "cmp-small",
						children: tr(how.note)
					}),
					recs.map((r, i) => /* @__PURE__ */ jsxs("div", {
						className: "recommend",
						children: [/* @__PURE__ */ jsx("span", {
							className: "priority " + String(r.level || "low").toLowerCase(),
							children: tr(r.level)
						}), /* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("strong", { children: tr(r.title) }),
							/* @__PURE__ */ jsx("p", { children: tr(r.text) }),
							/* @__PURE__ */ jsxs("div", {
								className: "cmp-chips",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "chip src " + r.source,
										children: tr(SOURCE_LABEL[r.source] || r.source)
									}),
									stepRef(r.step),
									areaNames(run, r).map((n) => /* @__PURE__ */ jsx("span", {
										className: "chip quiet",
										children: tr(n)
									}, n)),
									(r.clos || []).length > 0 && /* @__PURE__ */ jsx("span", {
										className: "chip quiet",
										children: t$3("ui.clo_069efc") + r.clos.join(", ")
									}),
									(r.rows || []).length > 0 && /* @__PURE__ */ jsx("span", {
										className: "chip quiet",
										children: tr(r.rows.length > 1 ? "Rows" : "Row") + " " + r.rows.map((x) => x + 1).join(", ")
									})
								]
							})
						] })]
					}, i))
				]
			}),
			run && recs.length === 0 && state === "scored" && run.findings && run.findings.length === 0 && /* @__PURE__ */ jsx("p", {
				className: "cmp-small",
				children: t$3("ui.nothing_to_improve_every_check_passed_60de97")
			}),
			showFindings && run && run.findings && run.findings.length > 0 && /* @__PURE__ */ jsxs("details", {
				className: "cmp-find",
				children: [/* @__PURE__ */ jsx("summary", { children: tr(run.findings.length + (run.findings.length === 1 ? " finding" : " findings")) + t$3("ui.behind_the_score_db725f") }), groupFindings(run).map((g) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h5", { children: tr(g.name) }), /* @__PURE__ */ jsx("ul", { children: g.findings.map((f) => /* @__PURE__ */ jsxs("li", {
					className: f.severity === "blocking" ? "blocking" : void 0,
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "chip src rule",
							children: f.severity === "blocking" ? t$3("ui.rule_blocks_submit_a7fc69") : t$3("ui.rule_78e179")
						}),
						" ",
						tr(f.message),
						" ",
						stepRef(f.step)
					]
				}, f.id)) })] }, g.key))]
			})
		]
	});
}
//#endregion
//#region src/views/builder2/useCompliance.js
function useCompliance({ syllabusId, saveFirst }) {
	const [run, setRun] = useState(null);
	const [installed, setInstalled] = useState(true);
	const [busy, setBusy] = useState(false);
	const [remote, setRemote] = useState(false);
	const [error, setError] = useState("");
	const alive = useRef(true);
	const checking = useRef(false);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const apply = (res) => {
		if (!alive.current) return;
		setRemote(!!res.checking);
		setInstalled(res.installed !== false);
		setRun(res.run || null);
		setError("");
	};
	const load = useCallback(async () => {
		const id = syllabusId();
		if (!id) return;
		try {
			apply(await compliance.get(id));
		} catch (e) {
			if (alive.current) setError(e.message);
		}
	}, []);
	const check = useCallback(async (force = false) => {
		if (checking.current) return;
		checking.current = true;
		setBusy(true);
		setError("");
		try {
			if (saveFirst && !await saveFirst()) {
				setError("Your latest changes could not be saved, so they were not checked.");
				return;
			}
			const id = syllabusId();
			if (!id) {
				setError("Choose a subject first.");
				return;
			}
			apply(await compliance.recheck(id, force));
		} catch (e) {
			if (!alive.current) return;
			if (e.status === 503) setInstalled(false);
			else setError(e.message);
		} finally {
			checking.current = false;
			if (alive.current) setBusy(false);
		}
	}, []);
	useEffect(() => {
		if (!remote || busy) return void 0;
		const timer = setInterval(load, 3e3);
		return () => clearInterval(timer);
	}, [
		remote,
		busy,
		load
	]);
	const pending = run && run.aiStatus === "pending";
	useEffect(() => {
		if (!run?.hybrid || busy) return void 0;
		const timer = setInterval(load, 3e4);
		return () => clearInterval(timer);
	}, [
		run?.id,
		busy,
		load
	]);
	useEffect(() => {
		if (!pending) return void 0;
		let tries = 0;
		const timer = setInterval(async () => {
			tries += 1;
			try {
				apply(await compliance.get(syllabusId()));
			} catch {}
			if (tries >= 15) clearInterval(timer);
		}, 2500);
		return () => clearInterval(timer);
	}, [pending, run && run.id]);
	return {
		run,
		installed,
		busy: busy || remote,
		error,
		load,
		check
	};
}
//#endregion
//#region src/views/builder2/ComplianceSection.jsx
function ComplianceSection({ syllabusId, saveFirst, canCheck, onOpenStep, onRun, onApplyDraft }) {
	const { run, installed, busy, error, load, check } = useCompliance({
		syllabusId,
		saveFirst
	});
	const [changed, setChanged] = useState(false);
	const apply = onApplyDraft ? async (patch) => {
		const done = await onApplyDraft(patch);
		setChanged(true);
		return done;
	} : void 0;
	const recheck = () => {
		setChanged(false);
		return check(true);
	};
	const legacy = !!(onApplyDraft && run?.hybrid?.suggestions?.some((s) => !Object.hasOwn(s, "originalValue")));
	const needsCheck = (changed || legacy) && canCheck && installed && !!run;
	useEffect(() => {
		load();
	}, [load]);
	useEffect(() => {
		if (onRun) onRun(busy ? null : run);
	}, [run, busy]);
	return /* @__PURE__ */ jsxs("section", {
		className: "cmp-card",
		id: "cmp-card",
		"aria-labelledby": "cmp-title",
		"aria-busy": busy,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "cmp-card-head",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
					id: "cmp-title",
					children: t$3("ui.compliance_check_cf2d1e")
				}), /* @__PURE__ */ jsx("p", {
					className: "cmp-small",
					children: t$3("ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a")
				})] }), canCheck && installed && /* @__PURE__ */ jsx(StableButton, {
					type: "button",
					className: "btn primary",
					disabled: busy,
					onClick: recheck,
					children: busy ? t$3("ui.checking_820d60") : t$3(run ? "hybrid.recheckButton" : "hybrid.checkButton")
				})]
			}),
			needsCheck && /* @__PURE__ */ jsx("div", {
				className: "hy-stale",
				role: "status",
				children: /* @__PURE__ */ jsx("span", { children: t$3(legacy && !changed ? "hybrid.refreshSuggestions" : "hybrid.recheckBanner") })
			}),
			!installed && /* @__PURE__ */ jsx("div", {
				className: "info-banner warning",
				children: t$3("hybrid.unavailable")
			}),
			error && /* @__PURE__ */ jsx("div", {
				className: "info-banner warning",
				role: "alert",
				children: tr(error)
			}),
			installed && !run && !error && !busy && /* @__PURE__ */ jsx("p", {
				className: "cmp-small",
				children: t$3("ui.not_checked_yet_8ea64e")
			}),
			installed && (run || busy) && /* @__PURE__ */ jsx(ComplianceCard, {
				run,
				checking: busy,
				onOpenStep,
				onApplyDraft: apply
			})
		]
	});
}
//#endregion
//#region src/views/builder2/ReviewStep.jsx
function ReviewStep({ d, model, go, preparedBy, existing, noteRequired, note, setNote, syllabusId, saveFirst, canCheck, submitFailed, onRun, onApplyDraft, showCompliance = true }) {
	const openStep = (key) => go(STEPS.findIndex((s) => s.key === key));
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [
		submitFailed && submitFailed.length > 0 && /* @__PURE__ */ jsxs("div", {
			className: "blockers",
			role: "alert",
			children: [/* @__PURE__ */ jsx("b", { children: t$3("ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3") }), /* @__PURE__ */ jsx("ul", { children: submitFailed.map((c) => /* @__PURE__ */ jsx("li", { children: tr(c.message) }, c.id)) })]
		}),
		showCompliance ? /* @__PURE__ */ jsx(ComplianceSection, {
			syllabusId,
			saveFirst,
			canCheck,
			onOpenStep: openStep,
			onRun,
			onApplyDraft
		}) : /* @__PURE__ */ jsx("div", {
			className: "info-banner",
			role: "note",
			children: t$3("publication.checkInTab")
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "rv",
			children: [/* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("span", {
					className: "lbl",
					children: t$3("ui.step_status_dc70c2")
				}),
				/* @__PURE__ */ jsx("div", {
					className: "chk",
					children: STEPS.slice(0, 6).map((s, i) => {
						const is = model.issues(d, s.key);
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => go(i),
							children: [/* @__PURE__ */ jsx("span", {
								className: "chkdot" + (is.length ? " w" : ""),
								children: is.length ? "!" : "✓"
							}), /* @__PURE__ */ jsxs("span", { children: [
								/* @__PURE__ */ jsx("b", {
									style: { fontWeight: 600 },
									children: tr(s.title)
								}),
								is.slice(0, 2).map((x, k) => /* @__PURE__ */ jsx("div", {
									className: "iss",
									children: tr(x.text)
								}, k)),
								is.length > 2 && /* @__PURE__ */ jsx("div", {
									className: "iss",
									children: t$3("ui.and_97e211") + (is.length - 2) + t$3("ui.more_84b30f")
								})
							] })]
						}, s.key);
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					style: { marginTop: 18 },
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "lbl",
							children: t$3("ui.sign_off_91a02d")
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "sig",
							children: [
								/* @__PURE__ */ jsxs("div", { children: [t$3("ui.prepared_by_47b758"), /* @__PURE__ */ jsxs("b", { children: [preparedBy, t$3("ui.from_your_account_870e41")] })] }),
								/* @__PURE__ */ jsxs("div", { children: [t$3("ui.checked_and_reviewed_by_e4719b"), /* @__PURE__ */ jsx("b", { children: t$3("ui.added_by_the_system_on_review_24a39a") })] }),
								/* @__PURE__ */ jsxs("div", { children: [t$3("ui.approved_by_b95366"), /* @__PURE__ */ jsx("b", { children: t$3("ui.added_by_the_system_on_approval_9614af") })] })
							]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "hint",
							style: { marginTop: 8 },
							children: t$3("ui.the_other_names_and_the_revision_date_are_added_by_the_system_whe_0aa097")
						})
					]
				}),
				existing && /* @__PURE__ */ jsxs("label", {
					className: "field",
					style: { marginTop: 18 },
					children: [
						/* @__PURE__ */ jsx("span", { children: noteRequired ? t$3("ui.what_did_you_change_required_c57040") : t$3("ui.what_changed_optional_8668e0") }),
						/* @__PURE__ */ jsx("textarea", {
							rows: "3",
							maxLength: 1e3,
							value: note,
							"aria-required": !!noteRequired,
							onChange: (e) => setNote(e.target.value),
							placeholder: t$3("ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9")
						}),
						noteRequired && note.trim().length < 10 && /* @__PURE__ */ jsx("small", {
							className: "hint",
							children: t$3("ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338")
						})
					]
				})
			] }), /* @__PURE__ */ jsx("div", {
				className: "scroll",
				children: /* @__PURE__ */ jsx(FormPaper, {
					d,
					model,
					preparedBy
				})
			})]
		})
	] });
}
//#endregion
//#region src/lib/pdfImportReview.js
const text = (value) => String(value ?? "").trim();
const codeKey = (value) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const titleKey = (value) => text(value).normalize("NFKC").toUpperCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const titleMatches = (a, b) => titleKey(a) === titleKey(b) || titleKey(a) === titleKey(text(b).replace(/\s*\([^()]+\)\s*$/, ""));
function importIdentity(fields, meta, context, required = false) {
	const fail = (reason) => ({
		ok: false,
		reason
	});
	if (fields.program && text(fields.program).toUpperCase() !== text(meta.program).toUpperCase()) return fail("program");
	if (context) {
		const selected = context.selected;
		if (!selected || selected.id !== meta.courseId || selected.program !== meta.program || selected.code !== meta.code || selected.title !== meta.title) return fail("selection");
		const curricula = context.curricula.filter((c) => c.program === selected.program && c.status === "approved" && (!meta.curriculumYear || c.curriculumYear === meta.curriculumYear));
		if (curricula.length !== 1) return fail("curriculum");
		const candidates = curricula[0].courses.filter((c) => codeKey(c.code) === codeKey(fields.code));
		if (!text(fields.code) || !text(fields.title) || candidates.length !== 1) return fail("course");
		const course = candidates[0];
		if (course.code !== selected.code || !titleMatches(fields.title, course.title) || !titleMatches(selected.title, course.title)) return fail("title");
		return {
			ok: true,
			program: selected.program,
			curriculumYear: curricula[0].curriculumYear,
			course
		};
	}
	if (required) return fail("context");
	return {
		ok: (!fields.code || codeKey(fields.code) === codeKey(meta.code)) && (!fields.title || titleMatches(fields.title, meta.title)),
		unverified: true
	};
}
function outcomeReferences(source, label) {
	const pattern = new RegExp(`\\b${label}s?\\s*[:=]?\\s*(\\d+(?:\\s*[-–—]\\s*\\d+)?(?:\\s*[,;.]\\s*\\d+(?:\\s*[-–—]\\s*\\d+)?)*)`, "gi");
	const values = [], invalid = [];
	const matches = [...String(source).matchAll(pattern)];
	for (const match of matches) {
		if (/^\s*[-–—/]/.test(String(source).slice(match.index + match[0].length))) invalid.push(match[0] + String(source).slice(match.index + match[0].length).match(/^\s*[-–—/]\S*/)[0]);
		for (const part of match[1].split(/[,;.]/)) {
			const [first, last = first] = part.trim().split(/\s*[-–—]\s*/).map(Number);
			if (first < 1 || last < first || last > 50) {
				invalid.push(match[0]);
				continue;
			}
			for (let n = first; n <= last; n++) values.push(n);
		}
	}
	return {
		values: [...new Set(values)],
		invalid,
		matches
	};
}
function iloChunks(source) {
	const raw = String(source || "");
	const starts = [0, ...[...raw.matchAll(/\b(?:I\s*LO|LO)\s*\d+(?:\s*[:.]|\s+(?=\p{L}))/giu)].map((m) => m.index)].filter((v, i, a) => a.indexOf(v) === i);
	const chunks = [];
	for (let i = 0; i < starts.length; i++) {
		const block = raw.slice(starts[i], starts[i + 1] ?? raw.length).trim();
		if (!block) continue;
		const last = outcomeReferences(block, "CLO").matches.at(-1);
		let end = last ? last.index + last[0].length : 0;
		if (last) end += block.slice(end).match(/^[\s,)\]]*/)?.[0].length || 0;
		if (last && /\p{L}/u.test(block.slice(end))) chunks.push({
			text: block.slice(0, end).trim(),
			ambiguous: true
		}, {
			text: block.slice(end).trim(),
			ambiguous: true
		});
		else chunks.push({
			text: block,
			ambiguous: !/^(?:I\s*LO|LO)\s*\d+/i.test(block)
		});
	}
	return chunks;
}
function prerequisiteReview(fields, meta, choice) {
	const existing = String(meta.prereq ?? ""), imported = text(fields.prereq);
	if (!existing.trim() || !imported || existing === imported) return {
		value: imported || existing,
		conflict: null
	};
	const decision = choice?.existing === existing && choice?.imported === imported && ["keep", "replace"].includes(choice.action) ? choice.action : null;
	return {
		value: decision === "replace" ? imported : existing,
		conflict: {
			existing,
			imported,
			decision
		}
	};
}
//#endregion
//#region src/lib/pdfImport.js
const PDF_FIELDS = [
	"code",
	"title",
	"description",
	"prereq",
	"credits",
	"clos",
	"plan",
	"reqs",
	"refs",
	"grading"
];
const PDF_OUTCOME_FIELDS = [
	"vision",
	"mission",
	"egas",
	"pos"
];
const lines = (text) => String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
const clean = (text) => String(text || "").replace(/^[-•]\s*/, "").trim();
const numbered = (text) => lines(text).filter((s) => !/^(?:CLO|ILO|WEEK|SCHEDULE|COMPONENT|PERCENTAGE)\s*(?:\||\t|$)/i.test(s));
const labelled = (text, label) => [...String(text || "").matchAll(new RegExp(`\\b${label}\\s*(\\d+)\\s*[.:]\\s*([\\s\\S]*?)(?=\\b${label}\\s*\\d+\\s*[.:]|$)`, "gi"))].map((match) => ({
	no: Number(match[1]),
	text: match[2].replace(/\s+/g, " ").trim()
}));
function referenceGroups(text, item) {
	const groups = Object.fromEntries([
		"books",
		"program",
		"online",
		"electronics"
	].map((key) => [key, {
		na: false,
		items: []
	}]));
	let group = null, buffer = "";
	const flush = () => {
		if (buffer) groups[group || (/https?:\/\//i.test(buffer) ? "online" : "books")].items.push(item(buffer));
		buffer = "";
	};
	for (const line of lines(text)) {
		const heading = line.match(/^(?:[A-Z][.)]\s*)?(BOOKS|INTERNET PROGRAMMING|INTERNET REFERENCES|JOURNALS|ELECTRONICS)\s*:?\s*$/i);
		if (heading) {
			flush();
			const name = heading[1].toUpperCase();
			group = name === "BOOKS" ? "books" : name === "INTERNET PROGRAMMING" ? "program" : name === "ELECTRONICS" ? "electronics" : "online";
			continue;
		}
		if (/^(?:N\/?A|NOT APPLICABLE)\.?$/i.test(line) && group) {
			flush();
			groups[group].na = true;
			continue;
		}
		const startsCitation = /^[A-Z][\p{L}'’-]+,\s*[A-Z]/u.test(line) || /^\d+[.)]\s/.test(line) || /Accessed.*\b\d{4}\.?$/i.test(buffer);
		if (buffer && (startsCitation || group === "electronics")) flush();
		buffer += (buffer ? " " : "") + line;
	}
	flush();
	return groups;
}
function mapPdfFields(fields, draft, makeId, { planRows = null, identityContext = null, requireIdentity = false, prerequisiteChoice = null } = {}) {
	const warnings = [];
	const unresolvedMappings = [];
	const missing = PDF_FIELDS.filter((key) => !String(fields[key] || "").trim());
	if (missing.length) warnings.push({
		key: "pdfImport.missing",
		values: { fields: missing.map((key) => PDF_FIELDS.indexOf(key) + 1).join(", ") }
	});
	const id = () => makeId();
	const item = (t) => ({
		id: id(),
		t: clean(t)
	});
	const next = structuredClone(draft);
	const outcomes = next.outcomes || {
		vision: "",
		mission: {
			lead: "",
			items: []
		},
		egas: [],
		pos: []
	};
	if (fields.vision?.trim()) outcomes.vision = fields.vision.trim();
	if (fields.mission?.trim()) {
		const parts = fields.mission.split(/\n\s*[•●▪-]\s*/).map((s) => s.trim()).filter(Boolean);
		outcomes.mission = {
			lead: parts[0] || "",
			items: parts.slice(1)
		};
	}
	if (fields.egas?.trim()) outcomes.egas = labelled(fields.egas, "EGA").map((entry) => ({
		no: entry.no,
		name: entry.text,
		short: entry.text.slice(0, 120)
	}));
	if (fields.pos?.trim()) outcomes.pos = labelled(fields.pos, "PO").map((entry) => ({
		no: entry.no,
		text: entry.text,
		short: `PO ${entry.no}`,
		egas: []
	}));
	next.outcomes = outcomes;
	const normalize = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
	const identity = importIdentity(fields, draft.meta, identityContext, requireIdentity);
	if (!fields.program && identityContext) warnings.push({
		key: "pdfImport.programReview",
		values: { program: draft.meta.program }
	});
	const mismatch = !identity.ok;
	if (mismatch) warnings.push({
		key: "pdfImport.identityMismatch",
		values: {
			code: fields.code?.trim() || "",
			selected: draft.meta.code
		}
	});
	if (fields.title?.trim() && normalize(fields.title) !== normalize(draft.meta.title)) warnings.push({
		key: "pdfImport.titleMismatch",
		values: {}
	});
	const prerequisite = prerequisiteReview(fields, draft.meta, prerequisiteChoice);
	next.meta.prereq = prerequisite.value;
	if (prerequisite.conflict) warnings.push({
		key: "pdfImport.prereqConflict",
		values: {}
	});
	const credits = fields.credits?.match(/^\s*(\d+(?:\.\d+)?)\s*(?:units?)?\s*$/i);
	if (credits) {
		next.meta.lecture = credits[1];
		next.meta.lab = "";
	}
	if (fields.credits?.trim()) warnings.push({
		key: "pdfImport.creditsReview",
		values: {}
	});
	next.description = [item((fields.description || "").replace(/\s*\n\s*/g, " "))];
	const cloSource = /\bCLO\s*\d+[.:]/i.test(fields.clos || "") ? [...String(fields.clos).matchAll(/\bCLO\s*\d+[.:]\s*([\s\S]*?)(?=\bCLO\s*\d+[.:]|$)/gi)].map((m) => m[0].replace(/\s*\n\s*/g, " ")) : numbered(fields.clos);
	const sourceCloNumbers = [];
	const clos = cloSource.map((line, i) => {
		const sourceNo = Number(line.match(/^\s*CLO\s*(\d+)/i)?.[1] || i + 1);
		const cells = line.split(/\t|\|/).map((s) => s.trim()).filter(Boolean);
		const selected = (label, available) => {
			const refs = outcomeReferences(line, label);
			const unknown = refs.values.filter((n) => !available.some((p) => p.no === n));
			if (unknown.length || refs.invalid.length) unresolvedMappings.push({
				clo: sourceNo,
				label,
				unknown,
				invalid: refs.invalid,
				source: line
			});
			return refs.values.filter((n) => available.some((p) => p.no === n));
		};
		const statement = (cells.length > 1 && /^(?:CLO\s*)?\d+[.)]?$/i.test(cells[0]) ? cells[1] : line).replace(/^(?:CLO\s*)?\d+[.):\s]+/i, "").replace(/\s*\[?\b(?:POs?|EGAs?)\s*[:=]?\s*\d.*$/i, "").trim();
		if (statement) sourceCloNumbers.push(sourceNo);
		return {
			id: id(),
			title: `CLO ${sourceNo}`,
			level: "Introductory",
			statement,
			pos: selected("PO", outcomes.pos),
			egas: selected("EGA", outcomes.egas)
		};
	}).filter((c) => c.statement);
	if (clos.length > 20) throw new Error("pdfImport.tooManyClos");
	if (new Set(sourceCloNumbers).size !== sourceCloNumbers.length) throw new Error("pdfImport.duplicateClos");
	next.clos = clos;
	warnings.push({
		key: "pdfImport.outcomesReview",
		values: {}
	});
	const plan = [];
	let ambiguous = false;
	const inputs = planRows || lines(fields.plan).flatMap((line) => {
		const cells = line.split(/\t|\|/).map((s) => s.trim());
		if (!/^(?:weeks?\s*)?\d+(?:\s*[-–,]\s*\d+)*$/i.test(cells[0]) || cells.length !== 6) {
			ambiguous = true;
			return [];
		}
		const [week, ilo, contents, activities, tasks, values] = cells;
		return [{
			week,
			ilo,
			contents,
			activities,
			tasks,
			values
		}];
	});
	for (const row of inputs) {
		const { week, ilo, contents, activities, tasks, values } = row;
		const kind = row.kind || (/EXAMINATION|\bEXAM\b/i.test(contents) ? "exam" : "lesson");
		const ilos = (kind === "exam" ? [{
			text: ilo || "",
			ambiguous: false
		}] : iloChunks(ilo)).map(({ text, ambiguous }, index) => {
			const refs = outcomeReferences(text, "CLO"), targets = refs.values;
			const unknown = targets.filter((n) => !sourceCloNumbers.includes(n));
			if (unknown.length || refs.invalid.length) unresolvedMappings.push({
				week,
				label: "CLO",
				unknown,
				invalid: refs.invalid,
				source: text
			});
			const tags = targets.map((no) => clos[sourceCloNumbers.indexOf(no)]).filter(Boolean).map((c) => `clo:${c.id}`);
			if (kind !== "exam" && (ambiguous || !tags.length)) warnings.push({
				key: "pdfImport.iloMappingReview",
				values: {
					week,
					outcome: index + 1
				}
			});
			const statement = text.replace(/[[(]\s*CLO\s*\d[^\])]*[)\]]/gi, "").replace(/\bCLO\s*\d+(?:\s*[-–—,;.]\s*\d+)*/gi, "").trim();
			return {
				id: id(),
				text: statement,
				tags: [...new Set(tags)]
			};
		});
		plan.push({
			id: id(),
			week: week.replace(/^weeks?\s*/i, ""),
			kind,
			ilos: ilos.length ? ilos : [{
				id: id(),
				text: "",
				tags: []
			}],
			contents,
			activities,
			tasks,
			values
		});
	}
	next.plan = plan.length ? plan : [{
		id: id(),
		week: "",
		kind: "lesson",
		ilos: [{
			id: id(),
			text: "",
			tags: []
		}],
		contents: "",
		activities: "",
		tasks: "",
		values: ""
	}];
	if (ambiguous || !plan.length) warnings.push({
		key: "pdfImport.planReview",
		values: {}
	});
	const requirements = [];
	const numberedRequirements = /^\s*(?:\d+[.)]|[•●▪])\s/m.test(fields.reqs || "");
	for (const line of lines(fields.reqs)) if (numberedRequirements && requirements.length && !/^(?:\d+[.)]|[•●▪])\s/.test(line)) requirements[requirements.length - 1] += " " + line;
	else requirements.push(line);
	next.reqs = requirements.map(item);
	next.refs = referenceGroups(fields.refs, item);
	warnings.push({
		key: "pdfImport.referencesReview",
		values: {}
	});
	const grading = [];
	for (const line of lines(fields.grading)) {
		if (/^\s*TOTAL\b/i.test(line)) continue;
		const m = line.match(/^(.+?)\s*(?:\||\t|:|[-–])?\s*(\d+(?:\.\d+)?)\s*%\s*$/);
		if (m) grading.push({
			id: id(),
			label: m[1].replace(/^\d+[.)]\s*/, "").replace(/[|:\t\s-]+$/, "").trim(),
			abbr: "",
			pct: m[2]
		});
	}
	next.grading = {
		rows: grading,
		override: {
			on: false,
			term: "",
			final: ""
		}
	};
	if (!grading.length || grading.reduce((sum, row) => sum + Number(row.pct), 0) !== 100) warnings.push({
		key: "pdfImport.gradingReview",
		values: {}
	});
	if (unresolvedMappings.length) warnings.push({
		key: "pdfImport.unresolvedMappings",
		values: {}
	});
	return {
		content: next,
		warnings,
		mismatch,
		identity,
		prerequisiteConflict: prerequisite.conflict,
		unresolvedMappings,
		counts: {
			clos: clos.length,
			plan: plan.length,
			references: Object.values(next.refs).reduce((sum, group) => sum + group.items.length, 0),
			grading: grading.length
		}
	};
}
function preparePdfImport(fields, draft, makeId, options = {}) {
	const mapped = mapPdfFields(fields, draft, makeId, {
		...options,
		requireIdentity: true
	});
	if (mapped.mismatch) throw new Error("pdfImport.selectMatchingSubject");
	if (mapped.prerequisiteConflict && !mapped.prerequisiteConflict.decision) throw new Error("pdfImport.prereqReviewRequired");
	if (mapped.unresolvedMappings.length) throw new Error("pdfImport.unresolvedMappings");
	return mapped;
}
//#endregion
//#region src/views/builder2/UploadPanel.jsx
const MAX_BYTES = 10485760;
const PLAN_COLUMNS = [
	"week",
	"ilo",
	"contents",
	"activities",
	"tasks",
	"values"
];
function UploadPanel({ draft, hasCourse, busy, disabled, disabledReason, onChooseCourse, onExtract, onApply }) {
	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(null);
	const [fields, setFields] = useState(null);
	const [planRows, setPlanRows] = useState(null);
	const [reviewed, setReviewed] = useState(false);
	const [prerequisiteChoice, setPrerequisiteChoice] = useState(null);
	const [phase, setPhase] = useState(null);
	const working = phase !== null;
	const [error, setError] = useState("");
	const [applyError, setApplyError] = useState("");
	const applyFeedback = useRef(null);
	const [enabled, setEnabled] = useState(null);
	const [configError, setConfigError] = useState(false);
	const [configAttempt, setConfigAttempt] = useState(0);
	const lock = useRef(false);
	useEffect(() => {
		if (applyError) {
			applyFeedback.current?.focus();
			applyFeedback.current?.scrollIntoView?.({
				block: "nearest",
				behavior: "smooth"
			});
		}
	}, [applyError]);
	const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
	useEffect(() => () => {
		if (url) URL.revokeObjectURL(url);
	}, [url]);
	useEffect(() => {
		let live = true;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8e3);
		setEnabled(null);
		setConfigError(false);
		syllabi.pdfImportConfig({ signal: controller.signal }).then((config) => {
			if (live) {
				if (typeof config.enabled !== "boolean") throw new Error("pdfImport.failed");
				setEnabled(config.enabled);
			}
		}).catch(() => {
			if (live) setConfigError(true);
		}).finally(() => clearTimeout(timeout));
		return () => {
			live = false;
			clearTimeout(timeout);
			controller.abort();
		};
	}, [configAttempt]);
	const mapped = useMemo(() => {
		if (!fields) return null;
		let counter = 0;
		try {
			return mapPdfFields(fields, draft, () => `pdf_preview_${++counter}`, {
				planRows,
				identityContext: preview?.identityContext,
				requireIdentity: true,
				prerequisiteChoice
			});
		} catch (e) {
			return {
				error: e.message,
				warnings: []
			};
		}
	}, [
		fields,
		draft,
		planRows,
		preview,
		prerequisiteChoice
	]);
	const pick = (f) => {
		if (busy || working || disabled || !f) return;
		if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
			setError("pdfImport.invalid");
			return;
		}
		if (f.size > MAX_BYTES) {
			setError("pdfImport.tooLarge");
			return;
		}
		setFile(f);
		setPreview(null);
		setFields(null);
		setPlanRows(null);
		setReviewed(false);
		setError("");
		setApplyError("");
		setPrerequisiteChoice(null);
	};
	const perform = async (action, nextPhase) => {
		if (lock.current) return;
		lock.current = true;
		setPhase(nextPhase);
		setError("");
		setApplyError("");
		try {
			await action();
		} catch (e) {
			(nextPhase === "apply" ? setApplyError : setError)(e.message || "pdfImport.failed");
		} finally {
			lock.current = false;
			setPhase(null);
		}
	};
	const extract = () => {
		if (!file) {
			setError("pdfImport.chooseFile");
			return;
		}
		if (!hasCourse) {
			setError("pdfImport.chooseSubject");
			return;
		}
		if (enabled === false) {
			setError("pdfImport.disabled");
			return;
		}
		return perform(async () => {
			const value = await onExtract(file);
			if (!value?.fields || !Array.isArray(value.pages)) throw new Error("pdfImport.failed");
			setPreview(value);
			setFields(value.fields);
			setPlanRows(value.layout?.planRows?.length ? value.layout.planRows : null);
			setReviewed(false);
			setPrerequisiteChoice(null);
		}, "scan");
	};
	const apply = () => {
		if (!reviewed) {
			setApplyError("pdfImport.reviewRequired");
			return;
		}
		if (mapped?.error) {
			setApplyError(mapped.error);
			return;
		}
		if (mapped?.mismatch) {
			setApplyError(t$3("pdfImport.identityMismatch", {
				code: fields.code?.trim(),
				selected: draft.meta.code
			}));
			return;
		}
		if (mapped?.prerequisiteConflict && !mapped.prerequisiteConflict.decision) {
			setApplyError("pdfImport.prereqReviewRequired");
			return;
		}
		if (mapped?.unresolvedMappings?.length) {
			setApplyError("pdfImport.unresolvedMappings");
			return;
		}
		return perform(() => onApply(fields, {
			planRows,
			prerequisiteChoice
		}), "apply");
	};
	const editField = (key, value) => {
		setFields((current) => ({
			...current,
			[key]: value
		}));
		setReviewed(false);
		setApplyError("");
	};
	const editRow = (index, key, value) => {
		setPlanRows((current) => current.map((row, i) => i === index ? {
			...row,
			[key]: value
		} : row));
		setReviewed(false);
		setApplyError("");
	};
	const columnLabel = (key) => key === "week" ? t$3("pdfImport.week") : t$3(`plan.heading.${key}`);
	const blocked = busy || working || disabled;
	return /* @__PURE__ */ jsxs("section", {
		className: "editor-card up-panel",
		"aria-labelledby": "up-title",
		"aria-busy": working,
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "editor-title",
				children: /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("span", {
						className: "eyebrow",
						children: t$3("pdfImport.eyebrow")
					}),
					/* @__PURE__ */ jsx("h2", {
						id: "up-title",
						children: t$3("pdfImport.title")
					}),
					/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.intro") })
				] })
			}),
			!hasCourse && /* @__PURE__ */ jsxs("div", {
				className: "info-banner warning",
				children: [
					t$3("pdfImport.chooseSubject"),
					" ",
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "link-btn",
						onClick: onChooseCourse,
						children: t$3("pdfImport.choose")
					})
				]
			}),
			disabled && /* @__PURE__ */ jsx("div", {
				className: "info-banner warning",
				role: "status",
				children: disabledReason ? tr(disabledReason) : t$3("pdfImport.readOnly")
			}),
			enabled === null && !configError && /* @__PURE__ */ jsx("p", {
				role: "status",
				children: t$3("pdfImport.availabilityLoading")
			}),
			configError && /* @__PURE__ */ jsxs("div", {
				className: "info-banner warning",
				role: "alert",
				children: [
					t$3("pdfImport.availabilityFailed"),
					" ",
					/* @__PURE__ */ jsx(StableButton, {
						type: "button",
						className: "btn outline",
						disabled: blocked,
						onClick: () => setConfigAttempt((n) => n + 1),
						children: t$3("pdfImport.retry")
					})
				]
			}),
			enabled === false && /* @__PURE__ */ jsx("div", {
				className: "info-banner warning",
				children: t$3("pdfImport.disabled")
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				disabled: blocked,
				className: "up-fields",
				children: [
					/* @__PURE__ */ jsxs("label", {
						className: "field",
						children: [/* @__PURE__ */ jsx("span", { children: t$3("pdfImport.file") }), /* @__PURE__ */ jsx("input", {
							type: "file",
							accept: ".pdf,application/pdf",
							onChange: (e) => {
								pick(e.target.files[0]);
								e.target.value = "";
							}
						})]
					}),
					file && /* @__PURE__ */ jsx("p", { children: file.name }),
					url && /* @__PURE__ */ jsxs("details", {
						className: "up-preview",
						children: [/* @__PURE__ */ jsx("summary", { children: t$3("pdfImport.pdfPreview") }), /* @__PURE__ */ jsx("iframe", {
							title: t$3("pdfImport.pdfPreview"),
							src: url
						})]
					}),
					error && /* @__PURE__ */ jsx("div", {
						className: "info-banner warning",
						role: "alert",
						children: error.startsWith("pdfImport.") ? t$3(error) : tr(error)
					}),
					phase === "apply" && /* @__PURE__ */ jsx("div", {
						className: "info-banner",
						role: "status",
						children: t$3("pdfImport.checking")
					}),
					/* @__PURE__ */ jsx(StableButton, {
						type: "button",
						className: "btn primary",
						disabled: blocked,
						onClick: extract,
						children: phase === "scan" ? t$3("pdfImport.extracting") : t$3("pdfImport.extract")
					}),
					preview && fields && /* @__PURE__ */ jsxs("div", {
						className: "pdf-import-review",
						children: [
							/* @__PURE__ */ jsx("h3", { children: t$3("pdfImport.reviewTitle") }),
							/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.reviewNote") }),
							/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.pages", {
								count: preview.pages.length,
								ocr: preview.pages.filter((p) => p.method === "ocr").length
							}) }),
							preview.pages.some((p) => p.method === "ocr") && /* @__PURE__ */ jsx("div", {
								className: "info-banner warning",
								children: t$3("pdfImport.ocrReview")
							}),
							mapped?.error && /* @__PURE__ */ jsx("div", {
								className: "info-banner warning",
								role: "alert",
								children: t$3(mapped.error)
							}),
							mapped?.warnings.length > 0 && /* @__PURE__ */ jsx("div", {
								className: "info-banner warning",
								children: /* @__PURE__ */ jsx("ul", { children: mapped.warnings.map((warning, i) => /* @__PURE__ */ jsx("li", { children: t$3(warning.key, warning.values) }, i)) })
							}),
							/* @__PURE__ */ jsxs("details", { children: [/* @__PURE__ */ jsx("summary", { children: t$3("pdfImport.sourceText") }), /* @__PURE__ */ jsx("pre", {
								className: "pdf-import-source",
								children: preview.text
							})] }),
							preview.layout?.warnings?.length > 0 && /* @__PURE__ */ jsx("div", {
								className: "info-banner warning",
								children: t$3("pdfImport.layoutWarning")
							}),
							!planRows && /* @__PURE__ */ jsx("p", { children: t$3("pdfImport.formatNote") }),
							PDF_FIELDS.map((key, index) => /* @__PURE__ */ jsxs("div", {
								className: "pdf-import-section",
								children: [key === "plan" && planRows ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
									/* @__PURE__ */ jsx("h4", { children: t$3("pdfImport.field.plan") }),
									/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.tableNote") }),
									/* @__PURE__ */ jsx("div", {
										className: "pdf-import-table",
										tabIndex: 0,
										role: "region",
										"aria-label": t$3("pdfImport.field.plan"),
										children: /* @__PURE__ */ jsxs("table", { children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [PLAN_COLUMNS.map((column) => /* @__PURE__ */ jsx("th", {
											scope: "col",
											children: columnLabel(column)
										}, column)), /* @__PURE__ */ jsx("th", {
											scope: "col",
											children: t$3("pdfImport.actions")
										})] }) }), /* @__PURE__ */ jsx("tbody", { children: planRows.map((row, i) => /* @__PURE__ */ jsxs("tr", { children: [PLAN_COLUMNS.map((column) => /* @__PURE__ */ jsxs("td", { children: [/* @__PURE__ */ jsx("textarea", {
											rows: column === "week" ? 2 : 5,
											"aria-label": t$3("pdfImport.cell", {
												row: i + 1,
												field: columnLabel(column)
											}),
											value: row[column] || "",
											onChange: (e) => editRow(i, column, e.target.value)
										}), column === "week" && row.sourcePages?.length > 0 && /* @__PURE__ */ jsx("small", { children: t$3("pdfImport.sourcePages", { pages: row.sourcePages.join(", ") }) })] }, column)), /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("button", {
											type: "button",
											className: "btn ghost",
											onClick: () => {
												setPlanRows((current) => current.filter((_, n) => n !== i));
												setReviewed(false);
												setApplyError("");
											},
											children: t$3("pdfImport.removeRow")
										}) })] }, i)) })] })
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: "btn outline",
										onClick: () => {
											setPlanRows((current) => [...current, {
												week: "",
												ilo: "",
												contents: "",
												activities: "",
												tasks: "",
												values: "",
												sourcePages: []
											}]);
											setReviewed(false);
											setApplyError("");
										},
										children: t$3("pdfImport.addRow")
									})
								] }) : /* @__PURE__ */ jsxs("label", {
									className: "field",
									children: [/* @__PURE__ */ jsx("span", { children: t$3(`pdfImport.field.${key}`, { number: index + 1 }) }), /* @__PURE__ */ jsx("textarea", {
										rows: [
											"clos",
											"plan",
											"refs"
										].includes(key) ? 7 : 3,
										maxLength: 18e4,
										value: fields[key] || "",
										onChange: (e) => editField(key, e.target.value)
									})]
								}), key === "clos" && PDF_OUTCOME_FIELDS.some((name) => fields[name]?.trim()) && /* @__PURE__ */ jsxs("div", {
									className: "pdf-import-outcomes",
									children: [/* @__PURE__ */ jsx("h4", { children: t$3("pdfImport.sourceOutcomes") }), PDF_OUTCOME_FIELDS.map((name) => /* @__PURE__ */ jsxs("label", {
										className: "field",
										children: [/* @__PURE__ */ jsx("span", { children: t$3(`pdfImport.field.${name}`) }), /* @__PURE__ */ jsx("textarea", {
											rows: name === "pos" ? 8 : 4,
											value: fields[name] || "",
											onChange: (e) => editField(name, e.target.value)
										})]
									}, name))]
								})]
							}, key)),
							mapped?.counts && /* @__PURE__ */ jsx("p", { children: t$3("pdfImport.mappingCounts", mapped.counts) }),
							mapped?.prerequisiteConflict && /* @__PURE__ */ jsxs("fieldset", {
								className: "pdf-import-prerequisite",
								children: [
									/* @__PURE__ */ jsx("legend", { children: t$3("pdfImport.prereqConflict") }),
									/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.prereqExisting", { value: mapped.prerequisiteConflict.existing }) }),
									/* @__PURE__ */ jsx("p", { children: t$3("pdfImport.prereqImported", { value: mapped.prerequisiteConflict.imported }) }),
									["keep", "replace"].map((action) => /* @__PURE__ */ jsxs("label", { children: [/* @__PURE__ */ jsx("input", {
										type: "radio",
										name: "pdf-prerequisite",
										checked: mapped.prerequisiteConflict.decision === action,
										onChange: () => {
											setPrerequisiteChoice({
												action,
												existing: mapped.prerequisiteConflict.existing,
												imported: mapped.prerequisiteConflict.imported
											});
											setReviewed(false);
											setApplyError("");
										}
									}), t$3(`pdfImport.prereq${action === "keep" ? "Keep" : "Replace"}`)] }, action))
								]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "pdf-import-confirm",
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									checked: reviewed,
									onChange: (e) => {
										setReviewed(e.target.checked);
										setApplyError("");
									}
								}), t$3("pdfImport.confirm")]
							}),
							!reviewed && /* @__PURE__ */ jsx("p", {
								className: "hint",
								children: t$3("pdfImport.reviewRequired")
							}),
							mapped?.mismatch && /* @__PURE__ */ jsx("p", {
								className: "hint",
								children: t$3("pdfImport.identityMismatch", {
									code: fields.code?.trim(),
									selected: draft.meta.code
								})
							}),
							applyError && /* @__PURE__ */ jsx("div", {
								className: "info-banner warning",
								role: "alert",
								tabIndex: -1,
								ref: applyFeedback,
								children: applyError.startsWith("pdfImport.") ? t$3(applyError) : tr(applyError)
							}),
							/* @__PURE__ */ jsx("div", {
								className: "up-actions",
								children: /* @__PURE__ */ jsx(StableButton, {
									type: "button",
									className: "btn primary",
									disabled: blocked,
									onClick: apply,
									children: phase === "apply" ? t$3("pdfImport.checking") : t$3("pdfImport.apply")
								})
							})
						]
					})
				]
			})
		]
	});
}
//#endregion
//#region src/views/builder2/useCatalog.js
function useCatalog(programCode, { snapshot = null, live = false, courseId = null } = {}) {
	const [programList, setProgramList] = useState([]);
	const [subject, setSubject] = useState(null);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState("");
	const [version, setVersion] = useState(0);
	const refresh = useCallback(() => setVersion((v) => v + 1), []);
	useEffect(() => {
		let active = true;
		outcomes.programs().then((rows) => {
			if (active) {
				setProgramList(rows);
				setLoaded(true);
				setError("");
			}
		}).catch((e) => {
			if (active) setError(e.message);
		});
		return () => {
			active = false;
		};
	}, [version]);
	useEffect(() => {
		if (!courseId || snapshot) {
			setSubject(null);
			return;
		}
		let active = true;
		courses$1.get(courseId).then((row) => {
			if (active) {
				setSubject(row);
				setError("");
			}
		}).catch((e) => {
			if (active) setError(e.message);
		});
		return () => {
			active = false;
		};
	}, [
		courseId,
		version,
		snapshot
	]);
	useEffect(() => {
		if (!live) return;
		const visible = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", visible);
		window.addEventListener("focus", visible);
		return () => {
			document.removeEventListener("visibilitychange", visible);
			window.removeEventListener("focus", visible);
		};
	}, [live, refresh]);
	const chosen = subject?.id === courseId ? subject : null;
	const model = useMemo(() => {
		if (!loaded && !snapshot) return null;
		let institution = {
			vision: "",
			mission: {
				lead: "",
				items: []
			},
			egas: []
		};
		const programs = {};
		if (snapshot?.institution) {
			institution = snapshot.institution;
			if (snapshot.program) programs[snapshot.program.code] = snapshot.program;
		} else if (chosen) {
			institution = {
				vision: chosen.standards.vision,
				mission: chosen.standards.mission,
				egas: chosen.standards.egas
			};
			const own = {
				name: chosen.program.name,
				egas: chosen.standards.egas,
				pos: chosen.standards.pos
			};
			programs[chosen.program.code] = own;
			if (programCode) programs[programCode] = own;
		}
		return createModel({
			institution,
			programs,
			year: CURRENT_SCHOOL_YEAR.startYear
		});
	}, [
		loaded,
		snapshot,
		chosen,
		programCode
	]);
	return {
		model,
		programList,
		resolvedProgramCode: chosen?.program.code,
		loading: !model && !error,
		error,
		refresh,
		version
	};
}
//#endregion
//#region src/views/builder2/index.jsx
const BODIES = {
	info: InfoStep,
	clos: ClosStep,
	plan: PlanStep,
	reqs: ReqStep,
	refs: RefsStep,
	grade: GradeStep,
	review: ReviewStep
};
const STEP_CONFIG = STEPS.map((s) => ({
	...s,
	component: BODIES[s.key],
	validate: (d, model) => s.key === "review" ? [] : model.issues(d, s.key)
}));
function SyllabusBuilderV2({ editing, user, notify, setPage, onSubmitted }) {
	const { draft, apply, set, setAndSave, save, saveNow, load, syllabusId } = useDraft(editing);
	const importBase = useRef(null);
	const importIdentity = useRef(null);
	const frozen = !!draft && !load.loading && !load.editable && !!draft.catalog;
	const { model, programList, loading: catalogLoading, error: catalogError, refresh: refreshCatalog, resolvedProgramCode } = useCatalog(draft ? draft.meta.program : "", {
		snapshot: frozen ? draft.catalog : null,
		live: !frozen,
		courseId: draft?.meta.courseId
	});
	useEffect(() => {
		if (load.editable && !frozen && resolvedProgramCode && draft?.meta.program !== resolvedProgramCode) apply((current) => ({
			...current,
			meta: {
				...current.meta,
				program: resolvedProgramCode
			}
		}));
	}, [
		resolvedProgramCode,
		draft?.meta.program,
		load.editable,
		frozen
	]);
	const [step, setStep] = useState(0);
	const [visited, setVisited] = useState({ 0: 1 });
	const [filter, setFilter] = useState(null);
	const [toast, setToast] = useState(null);
	const toastTimer = useRef(null);
	const [note, setNote] = useState("");
	const [courseList, setCourseList] = useState([]);
	const [courseTick, setCourseTick] = useState(0);
	const [busy, setBusy] = useState(false);
	const aiGate = useAiGate();
	const [mode, setMode] = useState("form");
	const [submitFailed, setSubmitFailed] = useState([]);
	const [lastRun, setLastRun] = useState(null);
	const [, refreshVerificationAge] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => refreshVerificationAge((value) => value + 1), 3e4);
		return () => clearInterval(timer);
	}, []);
	const receiveRun = (run) => setLastRun(run ? {
		...run,
		draftSignature: JSON.stringify(draft)
	} : null);
	const applyDraftRecommendation = async (patch) => {
		const next = applySuggestion(draft, patch, { requireOriginal: true });
		setLastRun(null);
		if (!await setAndSave(next)) throw Error("hybrid.suggestionSaveFailed");
		return true;
	};
	const [mine, setMine] = useState(null);
	useEffect(() => {
		let live = true;
		users.myAssignments().then((a) => {
			if (live) setMine(a);
		}).catch(() => {});
		return () => {
			live = false;
		};
	}, []);
	const program = draft ? draft.meta.program : "";
	useEffect(() => {
		if (!program) {
			setCourseList([]);
			return;
		}
		let live = true;
		courses$1.list(program, { except: syllabusId() }).then((l) => {
			if (live) setCourseList(l);
		}).catch(() => {
			if (live) setCourseList([]);
		});
		return () => {
			live = false;
		};
	}, [program, courseTick]);
	useEffect(() => {
		if (save.state !== "error" || save.code !== "syllabus_exists" || !draft || !draft.meta.courseId) return;
		set(clearCourse(draft));
		setCourseTick((n) => n + 1);
		setToast({
			msg: save.message,
			action: {
				label: t$3("builder.openMySyllabi"),
				fn: () => setPage("my-syllabi")
			}
		});
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), 1e4);
	}, [save]);
	if (load.loading || catalogLoading) return /* @__PURE__ */ jsx("div", {
		className: "empty",
		children: t$3("ui.loading_the_syllabus_builder_e89b32")
	});
	if (load.error || catalogError) return /* @__PURE__ */ jsxs("div", {
		className: "info-banner warning",
		children: [t$3("ui.could_not_open_the_builder_7169ab"), tr(load.error || catalogError)]
	});
	const gated = load.editable && !!user && user.role === "faculty";
	const isAdmin = user?.role === "admin";
	const titleOf = (item) => isAdmin && item.key === "review" ? t$3("publication.reviewSyllabus") : tr(item.title);
	const { statuses, complete, firstBlocked: blockedStep } = model.stepStatuses(draft, visited, { sequential: gated });
	const firstBlocked = gated ? blockedStep : -1;
	const canGo = (i) => !gated || firstBlocked < 0 || i <= firstBlocked;
	const say = (msg, action) => {
		setToast({
			msg,
			action
		});
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), 6e3);
	};
	const go = (i) => {
		if (!canGo(i)) {
			say("Finish step " + (firstBlocked + 1) + " first: " + STEP_CONFIG[firstBlocked].title + ".");
			return;
		}
		if (STEP_CONFIG[i] && STEP_CONFIG[i].key === "clos" && !frozen) refreshCatalog();
		setStep(i);
		setVisited((v) => ({
			...v,
			[i]: 1
		}));
		setFilter(null);
		window.scrollTo({
			top: 0,
			behavior: prefersReducedMotion() ? "auto" : "smooth"
		});
	};
	const undo = (prev) => ({
		label: "Undo",
		fn: () => {
			set(prev);
			setToast(null);
		}
	});
	const onChooseCourse = async (id) => {
		if (draft.meta.courseId && id !== draft.meta.courseId && !window.confirm(t$3("outcomes.changeSubject"))) return;
		if (!id) {
			set(clearCourse(draft));
			return;
		}
		try {
			const c = await courses$1.get(id);
			set(applyCourse(draft, c));
		} catch (e) {
			notify(t$3("ui.could_not_load_that_subject_8e9791") + e.message);
		}
	};
	const onChooseProgram = (code) => {
		if (draft.meta.courseId && code !== draft.meta.program && !window.confirm(t$3("outcomes.changeSubject"))) return;
		set({
			...clearCourse(draft),
			meta: {
				...clearCourse(draft).meta,
				program: code,
				prereq: draft.meta.prereq
			}
		});
	};
	const onDeleteRow = (id) => {
		const prev = draft;
		const row = draft.plan.find((r) => r.id === id);
		apply((x) => {
			x.plan = x.plan.filter((r) => r.id !== id);
			return x;
		});
		say("Week " + (row && row.week || "?") + " deleted.", undo(prev));
	};
	const saveFirst = async () => {
		const ok = await saveNow();
		if (!ok) notify(t$3("ui.could_not_save_your_changes_check_your_connection_and_try_again_17b0b0"));
		return ok;
	};
	const saveDraft = async () => {
		if (!await saveFirst()) return;
		if (!syllabusId()) {
			notify(t$3("ui.choose_a_subject_first_24357e"));
			return;
		}
		notify(t$3("builder.draftSaved"));
		setPage("my-syllabi");
	};
	const submit = async () => {
		setBusy(true);
		setSubmitFailed([]);
		try {
			if (!await saveFirst()) return;
			const id = syllabusId();
			if (!id) {
				notify(t$3("ui.choose_a_subject_first_24357e"));
				return;
			}
			if (isAdmin) {
				await syllabi.prepareCheck(id);
				setPage("ai");
				return;
			}
			onSubmitted(await syllabi.submitContent(id, note.trim()), existing);
		} catch (e) {
			if (e.data && Array.isArray(e.data.failed)) setSubmitFailed(e.data.failed);
			notify(t$3("ui.submit_failed_adb15a") + e.message);
		} finally {
			setBusy(false);
		}
	};
	const importPdf = async (file) => {
		setBusy(true);
		try {
			if (!draft.meta.courseId) throw new Error("pdfImport.chooseSubject");
			let id = syllabusId();
			if (!id) {
				if (!await saveFirst()) throw new Error("pdfImport.saveFailed");
				id = syllabusId();
			}
			if (!id) throw new Error("pdfImport.chooseSubject");
			importBase.current = JSON.stringify(draft);
			const preview = await syllabi.importPdf(id, file);
			importIdentity.current = preview.identityContext;
			return preview;
		} finally {
			setBusy(false);
		}
	};
	const applyPdfImport = async (fields, { planRows = null, prerequisiteChoice = null } = {}) => {
		if (!load.editable || importBase.current !== JSON.stringify(draft)) throw new Error("pdfImport.draftChanged");
		const mapped = preparePdfImport(fields, draft, newId, {
			planRows,
			prerequisiteChoice,
			identityContext: importIdentity.current
		});
		setBusy(true);
		try {
			setLastRun(null);
			if (!await setAndSave(mapped.content)) {
				importBase.current = JSON.stringify(mapped.content);
				throw new Error("pdfImport.saveFailed");
			}
			importBase.current = null;
			try {
				const result = await compliance.recheck(syllabusId(), true);
				if (!result.run) throw new Error(t$3("pdfImport.failed"));
				setLastRun({
					...result.run,
					draftSignature: JSON.stringify(mapped.content)
				});
				notify(t$3("pdfImport.checked"));
			} catch (error) {
				notify(t$3("pdfImport.savedCheckFailed", { message: error.message }));
			}
			setMode("form");
			setStep(6);
			return true;
		} finally {
			setBusy(false);
		}
	};
	const state = !!user && user.role === "faculty" ? assignmentState(mine) : null;
	const noAccess = !!user && user.role === "faculty" && (programList.length === 0 || state === "none" || state === "noSubject" && !draft.meta.courseId);
	const accessMessage = state === "noSubject" ? ASSIGNMENT_MESSAGES.noSubject : ASSIGNMENT_MESSAGES.none;
	const editable = load.editable && !noAccess;
	const existing = load.status !== "draft";
	const revising = isReturned(load.status);
	const needNote = noteMissing(load.status, note);
	const preparedBy = user ? user.name || user.firstName + " " + user.lastName : "";
	const doneCount = statuses.filter((x) => x === "done").length;
	const cfg = STEP_CONFIG[step];
	const warnings = warningCount(lastRun);
	const Body = cfg.component;
	const issues = cfg.validate(draft, model);
	const blocking = gated ? issues.filter((i) => i.blocking) : [];
	const advice = issues.filter((i) => !i.blocking);
	const mine_ = blocking.filter((i) => i.source === "form");
	const theirs = blocking.filter((i) => i.source === "admin");
	const prv = STEP_CONFIG[step - 1];
	const nxt = STEP_CONFIG[step + 1];
	const saveText = save.state === "error" ? "Not saved. " + (save.message || "Check your connection") + " " : save.state === "saving" || save.state === "pending" ? "Saving..." : "Auto-save enabled" + (save.time ? " · saved " + save.time : "");
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [
		/* @__PURE__ */ jsx(PageHead, {
			title: t$3("ui.syllabus_builder_editor_ac6179"),
			subtitle: t$3("ui.fill_in_the_institutional_syllabus_form_step_by_step_every_part_i_35903f"),
			actions: /* @__PURE__ */ jsx(StableButton, {
				className: "btn outline",
				disabled: !load.editable,
				onClick: saveDraft,
				children: t$3("builder.saveAsDraft")
			})
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "bld2-modes",
			role: "tablist",
			"aria-label": t$3("ui.how_to_submit_0e4bbb"),
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				role: "tab",
				"aria-selected": mode === "form",
				className: mode === "form" ? "active" : "",
				onClick: () => setMode("form"),
				children: t$3("ui.fill_in_the_form_e4aa1f")
			}), !isAdmin && /* @__PURE__ */ jsx("button", {
				type: "button",
				role: "tab",
				"aria-selected": mode === "upload",
				className: mode === "upload" ? "active" : "",
				onClick: () => setMode("upload"),
				children: t$3("ui.upload_a_file_instead_eaad9b")
			})]
		}),
		mode === "upload" && /* @__PURE__ */ jsx("div", {
			className: "bld2-slide bld2-from-right",
			children: /* @__PURE__ */ jsx(UploadPanel, {
				draft,
				hasCourse: !!draft.meta.courseId,
				busy,
				disabled: !editable,
				disabledReason: noAccess ? accessMessage : load.lockedReason,
				onExtract: importPdf,
				onApply: applyPdfImport,
				onChooseCourse: () => {
					setMode("form");
					setStep(0);
				}
			})
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "bld2-slide bld2-from-left" + (mode === "upload" ? " bld2-hidden" : ""),
			hidden: mode === "upload",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "course-strip",
				children: [
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: t$3("ui.course_code_9c9dad") }), /* @__PURE__ */ jsx("b", {
						className: "mono",
						children: draft.meta.code || "—"
					})] }),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: t$3("ui.course_title_265cd6") }), /* @__PURE__ */ jsx("b", { children: draft.meta.title || "—" })] }),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: t$3("ui.program_9d6800") }), /* @__PURE__ */ jsx("b", { children: draft.meta.program || "—" })] }),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: t$3("ui.school_year_ec856b") }), /* @__PURE__ */ jsx("b", {
						className: "mono",
						children: CURRENT_SCHOOL_YEAR.label
					})] }),
					/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: t$3("ui.status_bae7d5") }), /* @__PURE__ */ jsx("b", {
						className: "status " + load.status,
						children: tr(STATUS_LABELS[load.status] || load.status)
					})] })
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "editor-layout bld2",
				children: [/* @__PURE__ */ jsxs("nav", {
					className: "stepper",
					"aria-label": t$3("ui.steps_cdde4f"),
					children: [STEP_CONFIG.map((s, i) => {
						const k = statuses[i];
						const mark = k === "locked" ? /* @__PURE__ */ jsx(p$2, {
							size: 14,
							"aria-hidden": "true"
						}) : k === "done" ? "✓" : i === step ? "›" : k === "attn" ? "!" : "›";
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							className: (i === step ? "active " : "") + (k === "locked" || k === "done" || i !== step && k !== "todo" ? k : ""),
							"aria-current": i === step ? "step" : void 0,
							"aria-disabled": !canGo(i) || void 0,
							title: !canGo(i) ? t$3("ui.finish_step_316523") + (firstBlocked + 1) + t$3("ui.first_faeaef") : void 0,
							onClick: () => go(i),
							children: [
								/* @__PURE__ */ jsx("span", { children: i + 1 }),
								titleOf(s),
								/* @__PURE__ */ jsx("i", {
									"aria-label": k === "locked" ? t$3("ui.locked_adec79") : k === "done" ? t$3("ui.complete_0737c2") : i !== step && k === "attn" ? t$3("ui.needs_attention_3ad98d") : void 0,
									children: mark
								})
							]
						}, s.key);
					}), /* @__PURE__ */ jsx("div", {
						className: "prog",
						children: doneCount + t$3("ui.of_607f2d") + STEP_CONFIG.length + t$3("ui.complete_f37486")
					})]
				}), /* @__PURE__ */ jsxs("section", {
					className: "editor-card",
					"aria-labelledby": "bld2-title",
					children: [
						noAccess && /* @__PURE__ */ jsx("div", {
							className: "info-banner warning",
							children: tr(accessMessage)
						}),
						!noAccess && !load.editable && load.lockedReason && /* @__PURE__ */ jsxs("div", {
							className: "info-banner warning",
							children: [tr(load.lockedReason), t$3("ui.you_can_read_this_syllabus_but_not_change_it_until_an_administrat_4f4ecd")]
						}),
						revising && editable && /* @__PURE__ */ jsxs("div", {
							className: "info-banner rv-revising",
							role: "status",
							children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("b", { children: load.status === "rejected" ? t$3("builder.rejectedTitle") : t$3("ui.returned_for_revision_d2426a") }), t$3("ui.your_next_submission_becomes_d37d36") + (load.nextVersion || tr("the next version")) + t$3("ui.once_you_change_something_b3eaf9") + (load.version || tr("the version you submitted")) + t$3("ui.and_every_earlier_version_stay_in_the_history_f8dfa6")] }), load.reviewerNote && /* @__PURE__ */ jsx("span", {
								className: "rv-note",
								children: t$3("ui.reviewer_s_note_573dfd") + load.reviewerNote
							})]
						}),
						!noAccess && !load.editable && !load.lockedReason && /* @__PURE__ */ jsx("div", {
							className: "info-banner warning",
							children: tr(editBlockedReason({ status: load.status }))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "editor-title",
							children: [/* @__PURE__ */ jsxs("div", { children: [
								/* @__PURE__ */ jsx("span", {
									className: "eyebrow",
									children: t$3("ui.step_c5964d") + (step + 1) + t$3("ui.of_f69649") + STEP_CONFIG.length + (cfg.form === "Form" ? "" : " · " + tr("FORM SECTION") + " " + cfg.form)
								}),
								/* @__PURE__ */ jsx("h2", {
									id: "bld2-title",
									children: titleOf(cfg)
								}),
								/* @__PURE__ */ jsx("p", { children: isAdmin && cfg.key === "review" ? t$3("publication.reviewDescription") : tr(cfg.sub) })
							] }), /* @__PURE__ */ jsxs("span", {
								className: "autosave" + (save.state === "error" ? " error" : save.state === "saved" ? "" : " saving"),
								role: "status",
								children: [tr(saveText), save.state === "error" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "link",
									onClick: saveNow,
									children: t$3("ui.retry_9f5cd8")
								})]
							})]
						}),
						/* @__PURE__ */ jsx("fieldset", {
							disabled: !editable || busy,
							children: /* @__PURE__ */ jsx(Body, {
								d: draft,
								apply,
								editable,
								model,
								programList,
								courseList,
								onChooseCourse,
								onChooseProgram,
								filter,
								setFilter,
								onDeleteRow,
								go,
								preparedBy,
								existing,
								noteRequired: revising,
								note,
								setNote,
								syllabusId,
								saveFirst,
								showCompliance: !isAdmin,
								canCheck: !!user && user.role === "faculty" && !noAccess,
								submitFailed,
								onRun: receiveRun,
								onApplyDraft: editable ? applyDraftRecommendation : void 0
							})
						}),
						!nxt && !complete && /* @__PURE__ */ jsxs("div", {
							className: "step-hint",
							role: "status",
							children: [
								t$3("ui.finish_the_steps_marked_in_the_list_review_check_the_compliance_c_31bb82"),
								existing ? t$3("ui.saving_a_new_version_a8d794") : t$3("ui.submitting_8ee0db"),
								t$3("ui.unlock_once_steps_1_to_6_are_complete_f983eb")
							]
						}),
						step < 6 && mine_.length > 0 && /* @__PURE__ */ jsxs("div", {
							className: "blockers",
							role: "status",
							children: [/* @__PURE__ */ jsx("b", { children: t$3("ui.to_continue_3819bf") }), /* @__PURE__ */ jsx("ul", { children: mine_.map((x, k) => /* @__PURE__ */ jsx("li", { children: tr(x.text) }, k)) })]
						}),
						step < 6 && theirs.length > 0 && /* @__PURE__ */ jsxs("div", {
							className: "blockers admin",
							role: "status",
							children: [
								/* @__PURE__ */ jsx("b", { children: t$3("ui.this_step_cannot_be_completed_yet_d2c256") }),
								/* @__PURE__ */ jsx("ul", { children: theirs.map((x, k) => /* @__PURE__ */ jsx("li", { children: tr(x.text) }, k)) }),
								/* @__PURE__ */ jsx(StableButton, {
									type: "button",
									className: "btn outline",
									onClick: refreshCatalog,
									children: t$3("ui.check_again_e18504")
								})
							]
						}),
						!isAdmin && step === 6 && warnings > 0 && editable && /* @__PURE__ */ jsx("div", {
							className: "step-hint advice",
							role: "note",
							children: tr(warnings + (warnings === 1 ? " warning remains" : " warnings remain")) + t$3("ui.in_the_compliance_check_they_do_not_block_you_the_reviewer_will_s_d35203")
						}),
						step < 6 && advice.length > 0 && editable && /* @__PURE__ */ jsx("div", {
							className: "step-hint advice",
							role: "note",
							children: t$3("ui.suggestions_73fedd") + advice.map((x) => tr(x.text)).join(" ")
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "editor-footer",
							children: [prv && /* @__PURE__ */ jsx(StableButton, {
								type: "button",
								className: "btn outline",
								onClick: () => go(step - 1),
								children: "← " + titleOf(prv)
							}), /* @__PURE__ */ jsxs("div", { children: [nxt && /* @__PURE__ */ jsx(StableButton, {
								type: "button",
								className: "btn primary",
								disabled: blocking.length > 0,
								title: blocking.length ? t$3("ui.complete_this_step_to_continue_71b565") : void 0,
								onClick: () => go(step + 1),
								children: t$3("ui.next_94377f") + titleOf(nxt) + " →"
							}), !nxt && /* @__PURE__ */ jsx(Fragment$1, { children: /* @__PURE__ */ jsx(StableButton, {
								type: "button",
								className: "btn primary",
								disabled: busy || !editable || !draft.meta.courseId || !complete || needNote || !isAdmin && !canSubmitHybrid(lastRun, JSON.stringify(draft), aiGate),
								title: !isAdmin && !canSubmitHybrid(lastRun, JSON.stringify(draft), aiGate) ? t$3(aiGate === "advisory" ? "hybrid.hardGateRequired" : "hybrid.required") : void 0,
								onClick: submit,
								children: isAdmin ? t$3("publication.continueToCheck") : existing ? t$3("hybrid.submitVersion") : t$3("hybrid.submit")
							}) })] })]
						})
					]
				})]
			})]
		}),
		toast && /* @__PURE__ */ jsxs("div", {
			className: "bld2-toast",
			role: "status",
			children: [/* @__PURE__ */ jsx("span", { children: tr(toast.msg) }), toast.action && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: toast.action.fn,
				children: tr(toast.action.label)
			})]
		})
	] });
}
//#endregion
//#region scripts/lcup-evaluation-readiness/workflow.test.jsx
const rootPath = process.cwd();
const require$1 = createRequire(import.meta.url);
const mysql = require$1(path.join(rootPath, "server/node_modules/mysql2/promise"));
const express = require$1(path.join(rootPath, "server/node_modules/express"));
const { loadCourse } = require$1(path.join(rootPath, "server/lib/courses"));
const importRouter = require$1(path.join(rootPath, "server/routes/pdfImport"));
const contentRouter = require$1(path.join(rootPath, "server/routes/syllabusContent"));
const schemaDdl = require$1(path.join(rootPath, "server/db/syllabuscheck-ddl"));
const output = path.join(rootPath, "docs/lcup-evaluation-readiness");
const read = async (f) => JSON.parse(await fs.readFile(path.join(rootPath, "docs/lcup-approved-offline", f), "utf8"));
const audit = JSON.parse(await fs.readFile(path.join(output, "current-pos.json"), "utf8"));
const browser = new Window({ url: "http://localhost:5173" });
Object.assign(globalThis, {
	window: browser,
	document: browser.document,
	HTMLElement: browser.HTMLElement,
	Event: browser.Event,
	MouseEvent: browser.MouseEvent,
	IS_REACT_ACT_ENVIRONMENT: true
});
const { createRoot } = await import("react-dom/client");
URL.createObjectURL = () => "blob:isolated-source";
URL.revokeObjectURL = () => {};
const nativeFetch = globalThis.fetch;
let pool;
let server;
let origin;
let sentinelBefore;
const requests = [];
const results = [];
const courses = [];
const fixtures = [];
let aiCalls = 0;
let sqlWrites = 0;
const comparable = (c) => ({
	meta: {
		program: c.meta.program,
		code: c.meta.code,
		title: c.meta.title,
		prereq: c.meta.prereq,
		curriculumYear: c.meta.curriculumYear
	},
	clos: c.clos.map((x) => ({
		statement: x.statement,
		pos: x.pos,
		egas: x.egas
	})),
	plan: c.plan.map((r) => ({
		week: r.week,
		kind: r.kind,
		ilos: r.ilos.map((i) => ({
			text: i.text,
			tags: i.tags.map((tag) => c.clos.findIndex((x) => tag === `clo:${x.id}`) + 1)
		})),
		contents: r.contents,
		activities: r.activities,
		tasks: r.tasks,
		values: r.values
	})),
	outcomes: c.outcomes,
	description: c.description.map((i) => i.t),
	refs: Object.fromEntries(Object.entries(c.refs).map(([key, g]) => [key, {
		na: g.na,
		items: g.items.map((i) => i.t)
	}])),
	grading: c.grading.rows.map((r) => ({
		label: r.label,
		pct: r.pct
	}))
});
before(async () => {
	const config = {
		host: "127.0.0.1",
		port: 43307,
		user: "root",
		password: "lcup-isolated-only",
		multipleStatements: false,
		connectionLimit: 3
	};
	const conn = await mysql.createConnection(config);
	const [[identity]] = await conn.query("SELECT @@datadir AS datadir, @@port AS port, VERSION() AS version");
	const expected = path.join(rootPath, "tmp/lcup-evaluation-readiness-db/data").replaceAll("\\", "/").toLowerCase();
	assert.equal(identity.datadir.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase(), expected);
	assert.equal(identity.port, 43307);
	await fs.writeFile(path.join(output, "disposable-database.json"), JSON.stringify({
		identity,
		guardVerified: true,
		productionConfigUsed: false
	}, null, 2) + "\n");
	const database = `lcup_import_evaluation_${process.pid}`;
	await conn.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
	await conn.end();
	pool = mysql.createPool({
		...config,
		database
	});
	const schema = await fs.readFile(path.join(rootPath, "server/db/schema.sql"), "utf8");
	const tables = /* @__PURE__ */ new Set([
		"users",
		"curriculum",
		"programs",
		"program_egas",
		"program_outcomes",
		"courses",
		"course_clos",
		"faculty_programs",
		"faculty_courses",
		"syllabi"
	]);
	for (const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\([\s\S]*?\n\);/g)) if (tables.has(match[1])) await pool.query(match[0]);
	await pool.query(schemaDdl[0]);
	await pool.query("INSERT INTO users(user_id,email,password_hash,role,first_name,last_name) VALUES(5,'isolated@example.invalid','test-only','faculty','Isolated','Tester'),(6,'sentinel@example.invalid','test-only','faculty','Sentinel','Tester')");
	for (const key of [
		"it202",
		"ie402",
		"cpe304"
	]) fixtures.push(await read(`${key}.fixture.json`));
	for (const [index, code] of [
		"BSIT",
		"BSIE",
		"BSCPE",
		"BSIT-CYBERSECURITY"
	].entries()) {
		const id = index + 1, program = audit.programs[code];
		await pool.query("INSERT INTO programs(program_id,code,name) VALUES(?,?,?)", [
			id,
			code,
			`Isolated ${code}`
		]);
		await pool.query("INSERT INTO faculty_programs(user_id,program_id) VALUES(5,?)", [id]);
		for (const c of program.masters.curricula) await pool.query("INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)", [
			code,
			c.curriculumYear,
			"approved",
			c.source,
			JSON.stringify(c.courses)
		]);
		const fixture = fixtures.find((f) => f.content.meta.program === code);
		const record = program.masters.curricula[0].courses.find((c) => fixture ? c.code.replace(/[^A-Z0-9]/gi, "").toUpperCase() === fixture.content.meta.code.replace(/[^A-Z0-9]/gi, "").toUpperCase() : c.code === "IT-202");
		const courseId = index + 25, standards = {
			...program.masters.institution,
			pos: program.ownPos
		};
		await pool.query("INSERT INTO courses(course_id,code,title,program_id,standards_json) VALUES(?,?,?,?,?)", [
			courseId,
			record.code,
			record.title,
			id,
			JSON.stringify(standards)
		]);
		await pool.query("INSERT INTO faculty_courses(user_id,course_id) VALUES(5,?)", [courseId]);
		const content = structuredClone(fixture?.content || fixtures[0].content);
		Object.assign(content.meta, {
			courseId,
			code: record.code,
			title: record.title,
			program: code,
			curriculumYear: program.masters.curricula[0].curriculumYear,
			prereq: "ISOLATED EXISTING PREREQUISITE"
		});
		content.description = [{
			id: "isolated_before",
			t: "ISOLATED BEFORE IMPORT"
		}];
		await pool.query("INSERT INTO syllabi(syllabus_id,user_id,course_id,status,version,content,content_schema_version) VALUES(?,5,?,'draft','v1.0',?,3)", [
			id,
			courseId,
			JSON.stringify(content)
		]);
		courses.push({
			id: courseId,
			syllabusId: id,
			code: record.code,
			title: record.title,
			program: code,
			initial: content
		});
	}
	await pool.query("INSERT INTO syllabi(syllabus_id,user_id,status,version,content,content_schema_version) VALUES(9001,6,'approved','v1.0','{\"sentinel\":\"synthetic unrelated record\"}',3)");
	[sentinelBefore] = await pool.query("SELECT * FROM syllabi WHERE syllabus_id=9001");
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	const tracked = {
		query: async (sql, params) => {
			if (!/^SELECT/i.test(sql)) sqlWrites++;
			return pool.query(sql, params);
		},
		getConnection: () => pool.getConnection()
	};
	app.locals.db = tracked;
	app.use((req, res, next) => {
		req.session = { user: {
			id: 5,
			role: "faculty",
			firstName: "Isolated",
			lastName: "Tester"
		} };
		requests.push({
			method: req.method,
			path: req.path
		});
		next();
	});
	app.get("/api/programs", async (req, res) => res.json(courses.map((c) => ({
		code: c.program,
		name: `Isolated ${c.program}`
	}))));
	app.get("/api/courses/:id", async (req, res) => res.json(await loadCourse(pool, Number(req.params.id))));
	app.get("/api/courses", async (req, res) => res.json(courses.filter((c) => c.program === req.query.program)));
	app.get("/api/users/me/assignments", (req, res) => res.json({
		courseIds: courses.map((c) => c.id),
		programIds: [
			1,
			2,
			3,
			4
		]
	}));
	app.get("/api/syllabus-check/status", (req, res) => res.json({ aiGate: "advisory" }));
	app.get("/api/syllabi/:id/compliance", (req, res) => res.json({
		installed: true,
		run: null
	}));
	app.post("/api/syllabi/:id/compliance/recheck", (req, res) => {
		aiCalls++;
		res.json({ run: {
			id: aiCalls,
			status: "insufficient",
			overall: null,
			stale: false,
			findings: [],
			areas: [],
			recommendations: [],
			aiStatus: "mocked",
			filledSections: 0,
			passThreshold: 79
		} });
	});
	app.use("/api/syllabi", importRouter);
	app.use("/api/syllabi", contentRouter);
	app.use((req, res) => res.status(404).json({ error: `Unexpected isolated request: ${req.method} ${req.path}` }));
	server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.on("listening", resolve));
	origin = `http://127.0.0.1:${server.address().port}`;
	globalThis.fetch = (url, options) => {
		const value = String(url), local = value.replace(/^http:\/\/localhost:3001/, origin);
		if (!local.startsWith(origin + "/api/")) throw Error(`External network denied in workflow test: ${value}`);
		return nativeFetch(local, options);
	};
});
after(async () => {
	if (pool) {
		const [sentinelAfter] = await pool.query("SELECT * FROM syllabi WHERE syllabus_id=9001");
		const untouched = JSON.stringify(sentinelBefore) === JSON.stringify(sentinelAfter);
		await fs.writeFile(path.join(output, "workflow-results.json"), JSON.stringify({
			results,
			requests,
			mockedAiCalls: aiCalls,
			paidAiCalls: 0,
			syntheticSentinelUnchanged: untouched,
			productionDatabaseWrites: 0,
			scope: "Actual React builder in simulated DOM; real HTTP upload/content routes and isolated MariaDB; AI/ancillary endpoints mocked"
		}, null, 2) + "\n");
		assert.equal(untouched, true);
		await pool.end();
	}
	globalThis.fetch = nativeFetch;
	setLanguage("en");
	if (server) await new Promise((resolve) => server.close(resolve));
});
async function waitFor(fn, message) {
	for (let i = 0; i < 200; i++) {
		if (fn()) return;
		await act(async () => new Promise((r) => setTimeout(r, 25)));
	}
	throw Error(message);
}
async function mount(id) {
	const host = document.createElement("div");
	document.body.append(host);
	const react = createRoot(host);
	await act(async () => react.render(/* @__PURE__ */ jsx(SyllabusBuilderV2, {
		editing: { syllabusId: id },
		user: {
			id: 5,
			role: "faculty"
		},
		notify: () => {},
		setPage: () => {},
		onSubmitted: () => {}
	})));
	await waitFor(() => host.querySelector(".bld2-modes"), "Builder did not load");
	return {
		host,
		react,
		close: async () => {
			await act(async () => react.unmount());
			host.remove();
		}
	};
}
const button = (host, label) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(label));
async function upload(ui, key) {
	const tab = ui.host.querySelectorAll(".bld2-modes [role=tab]")[1];
	await act(async () => tab.click());
	const fixture = fixtures.find((f) => f.key === key), bytes = await fs.readFile(path.join(rootPath, fixture.source.file));
	const input = ui.host.querySelector("input[type=file]");
	Object.defineProperty(input, "files", {
		configurable: true,
		value: [new File([bytes], path.basename(fixture.source.file), { type: "application/pdf" })]
	});
	await act(async () => input.dispatchEvent(new browser.Event("change", { bubbles: true })));
	await act(async () => button(ui.host, t$3("pdfImport.extract")).click());
	await waitFor(() => ui.host.querySelector(".pdf-import-review"), "No PDF preview");
	assert.ok(ui.host.textContent.includes(t$3("pdfImport.reviewTitle")));
}
for (const language of ["en", "tl"]) for (const action of ["keep", "replace"]) for (const [index, key] of [
	"it202",
	"ie402",
	"cpe304"
].entries()) test(`${language} ${key} ${action}: PDF upload → preview → Apply → real save → unmount → reopen`, async () => {
	setLanguage(language);
	importRouter.limiter.reset();
	const entry = courses[index], fixture = fixtures[index];
	await pool.query("UPDATE syllabi SET content=? WHERE syllabus_id=?", [JSON.stringify(entry.initial), entry.syllabusId]);
	const start = requests.length, aiBefore = aiCalls;
	let ui = await mount(entry.syllabusId);
	try {
		await upload(ui, key);
		assert.equal(requests.slice(start).filter((r) => r.method === "PUT").length, 0, "Preview must not save");
		assert.equal(aiCalls, aiBefore);
		const radios = ui.host.querySelectorAll(".pdf-import-prerequisite input");
		assert.equal(radios.length, 2);
		await act(async () => radios[action === "keep" ? 0 : 1].click());
		await act(async () => ui.host.querySelector(".pdf-import-confirm input").click());
		await act(async () => button(ui.host, t$3("pdfImport.apply")).click());
		await waitFor(() => aiCalls === aiBefore + 1, "Apply did not reach the mocked AI endpoint after save");
		const saved = await (await fetch(`${origin}/api/syllabi/${entry.syllabusId}/content`)).json();
		assert.equal(saved.content.meta.program, entry.program);
		assert.equal(saved.content.meta.code, entry.code);
		assert.equal(saved.content.meta.title, entry.title);
		assert.equal(saved.content.meta.prereq, action === "keep" ? "ISOLATED EXISTING PREREQUISITE" : fixture.content.meta.prereq);
		assert.equal(saved.content.meta.curriculumYear, entry.initial.meta.curriculumYear);
		assert.deepEqual(saved.content.clos.map((c) => c.pos), fixture.content.clos.map((c) => c.pos));
		assert.deepEqual(saved.content.clos.map((c) => c.egas), fixture.content.clos.map((c) => c.egas));
		const links = (c) => c.plan.filter((r) => r.kind !== "exam").flatMap((r) => r.ilos).filter((i) => i.text.trim()).map((i) => i.tags.map((tag) => c.clos.findIndex((clo) => `clo:${clo.id}` === tag) + 1));
		assert.deepEqual(links(saved.content), links(fixture.content));
		const sequence = requests.slice(start), put = sequence.findIndex((r) => r.method === "PUT" && r.path.endsWith("/content")), check = sequence.findIndex((r) => r.path.endsWith("/compliance/recheck"));
		assert.ok(put >= 0 && check > put);
		await ui.close();
		ui = await mount(entry.syllabusId);
		assert.ok(ui.host.textContent.includes(entry.code));
		const reopened = await (await fetch(`${origin}/api/syllabi/${entry.syllabusId}/content`)).json();
		assert.deepEqual(comparable(reopened.content), comparable(saved.content));
		let fallbackId = 0;
		const hydrated = hydrateContent(reopened.content, () => `unused_fallback_${++fallbackId}`);
		assert.deepEqual(comparable(hydrated), comparable(saved.content));
		assert.deepEqual(hydrated.clos.map((c) => c.id), saved.content.clos.map((c) => c.id));
		assert.deepEqual(hydrated.plan.flatMap((r) => r.ilos.map((i) => i.id)), saved.content.plan.flatMap((r) => r.ilos.map((i) => i.id)));
		results.push({
			language,
			key,
			action,
			roundTrip: true,
			cloPo: saved.content.clos.reduce((n, c) => n + c.pos.length, 0),
			cloEga: saved.content.clos.reduce((n, c) => n + c.egas.length, 0),
			iloClo: links(saved.content).reduce((n, v) => n + v.length, 0),
			prereq: saved.content.meta.prereq
		});
	} finally {
		await ui.close();
	}
});
for (const language of ["en", "tl"]) test(`${language}: BSIT IT202 PDF is blocked for Cyber IT-202 before save/check`, async () => {
	setLanguage(language);
	importRouter.limiter.reset();
	const entry = courses[3], start = requests.length, aiBefore = aiCalls;
	const [[before]] = await pool.query("SELECT content FROM syllabi WHERE syllabus_id=?", [entry.syllabusId]);
	const ui = await mount(entry.syllabusId);
	try {
		await upload(ui, "it202");
		await act(async () => ui.host.querySelector(".pdf-import-confirm input").click());
		await act(async () => button(ui.host, t$3("pdfImport.apply")).click());
		assert.ok(ui.host.querySelector(".pdf-import-review [role=alert][tabindex]"));
		assert.ok(ui.host.textContent.includes(t$3("pdfImport.identityMismatch", {
			code: "IT 202",
			selected: "IT-202"
		})));
		assert.equal(requests.slice(start).filter((r) => r.method === "PUT").length, 0);
		assert.equal(aiCalls, aiBefore);
		const [[after]] = await pool.query("SELECT content FROM syllabi WHERE syllabus_id=?", [entry.syllabusId]);
		assert.equal(after.content, before.content);
		results.push({
			language,
			key: "cyber-collision",
			blockedBeforeSave: true
		});
	} finally {
		await ui.close();
	}
});
for (const language of ["en", "tl"]) test(`${language}: unresolved prerequisite choice blocks before save/check`, async () => {
	setLanguage(language);
	importRouter.limiter.reset();
	const entry = courses[0], start = requests.length, aiBefore = aiCalls;
	await pool.query("UPDATE syllabi SET content=? WHERE syllabus_id=?", [JSON.stringify(entry.initial), entry.syllabusId]);
	const ui = await mount(entry.syllabusId);
	try {
		await upload(ui, "it202");
		await act(async () => ui.host.querySelector(".pdf-import-confirm input").click());
		await act(async () => button(ui.host, t$3("pdfImport.apply")).click());
		assert.ok(ui.host.textContent.includes(t$3("pdfImport.prereqReviewRequired")));
		assert.equal(requests.slice(start).filter((r) => r.method === "PUT").length, 0);
		assert.equal(aiCalls, aiBefore);
		const [[row]] = await pool.query("SELECT content FROM syllabi WHERE syllabus_id=?", [entry.syllabusId]);
		assert.equal(row.content, JSON.stringify(entry.initial));
		results.push({
			language,
			key: "prerequisite-decision",
			blockedBeforeSave: true
		});
	} finally {
		await ui.close();
	}
});
//#endregion
export {};
