<!-- Generated from packages/core/src/catalog/fields.ts by `npm run fields`. Do not edit by hand. -->

# Accepted fields

These are the 82 fields RosterRadius knows. In the [app inventory](inventory.md), the [contracts file](contracts.md) and the [declared list](declared.md), write a field by its **key** or its **label**. When RosterRadius reads a file, it also recognizes the Clever and OneRoster column names and the other common names listed here.

The sensitivity weight is explained in the [methodology](../../METHODOLOGY.md#5-sensitivity-classes). Contracts and declared lists are compared by Exhibit B category; staff, school and section fields have none.

## Student (46)

| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |
|---|---|---|---|---|---|---|
| `student.sis_id` | Student ID (district system) | Identifiers and contact (3) | Student Identifiers | `students.Student id` | `users.sourcedId` | `ID`<br>`Student ID`<br>`StudentID`<br>`SIS ID`<br>`Local ID`<br>`Local Student ID` |
| `student.student_number` | Student number | Identifiers and contact (3) | Student Identifiers | `students.Student number` | `users.identifier` |  |
| `student.state_id` | State student ID | Identifiers and contact (3) | Student Identifiers | `students.State id` |  | `SSID`<br>`State ID`<br>`State Student ID` |
| `student.other_ids` | Other student IDs | Identifiers and contact (3) | Student Identifiers |  | `users.userIds` |  |
| `student.username` | Student username | Identifiers and contact (3) | Student Identifiers | `students.Username` | `users.username` |  |
| `student.password` | Student password | Credentials (5) | Student Identifiers | `students.Password` | `users.password` |  |
| `student.first_name` | Student first name | Identifiers and contact (3) | Student Name | `students.First name` | `users.givenName` |  |
| `student.middle_name` | Student middle name | Identifiers and contact (3) | Student Name | `students.Middle name` | `users.middleName` |  |
| `student.last_name` | Student last name | Identifiers and contact (3) | Student Name | `students.Last name` | `users.familyName` |  |
| `student.preferred_name` | Student preferred name | Identifiers and contact (3) | Student Name | `students.Preferred first name`<br>`students.Preferred middle name`<br>`students.Preferred last name` |  |  |
| `student.email` | Student email | Identifiers and contact (3) | Student Contact Information | `students.Student email` | `users.email` |  |
| `student.phone` | Student phone | Identifiers and contact (3) | Student Contact Information |  | `users.phone`<br>`users.sms` |  |
| `student.address` | Student home address | Location (5) | Student Contact Information | `students.Student street`<br>`students.Student city`<br>`students.Student state`<br>`students.Student zip` |  | `Home Address`<br>`Street Address`<br>`Street`<br>`Mailing Address` |
| `student.birth_date` | Date of birth | Date and place of birth (4) | Demographics | `students.DOB` | `demographics.birthDate` |  |
| `student.birth_place` | Place of birth | Date and place of birth (4) | Demographics |  | `demographics.countryOfBirthCode`<br>`demographics.stateOfBirthAbbreviation`<br>`demographics.cityOfBirth` |  |
| `student.gender` | Gender or sex | Demographic (4) | Demographics | `students.Gender` | `demographics.sex` | `Sex` |
| `student.race` | Race | Demographic (4) | Demographics | `students.Race` | `demographics.americanIndianOrAlaskaNative`<br>`demographics.asian`<br>`demographics.blackOrAfricanAmerican`<br>`demographics.nativeHawaiianOrOtherPacificIslander`<br>`demographics.white`<br>`demographics.demographicRaceTwoOrMoreRaces` | `Ethnicity`<br>`Race/Ethnicity`<br>`Race Ethnicity`<br>`Federal Race` |
| `student.hispanic_latino` | Hispanic or Latino ethnicity | Demographic (4) | Demographics | `students.Hispanic Latino` | `demographics.hispanicOrLatinoEthnicity` | `Hispanic`<br>`Hispanic/Latino`<br>`Hispanic or Latino` |
| `student.home_language` | Home language | Demographic (4) | Demographics | `students.Home language` |  | `Home Language`<br>`Primary Language`<br>`Language` |
| `student.residence_status` | Public school residence status | Demographic (4) | Demographics |  | `demographics.publicSchoolResidenceStatus` |  |
| `student.grade_level` | Grade level | Organizational (1) | Enrollment | `students.Grade` | `users.grades` | `Grade Level`<br>`Current Grade` |
| `student.graduation_year` | Graduation year | Organizational (1) | Enrollment | `students.Graduation year` |  | `Graduation Year`<br>`Grad Year`<br>`Cohort Year` |
| `student.school` | School attended | Organizational (1) | Enrollment | `students.School id` | `users.orgSourcedIds` |  |
| `student.class_enrollments` | Classes the student is enrolled in | Organizational (1) | Schedule | `enrollments.Section id` | `enrollments.classSourcedId` |  |
| `student.guardian_links` | Links to the student’s guardians | Identifiers and contact (3) | Parent/Guardian ID |  | `users.agentSourcedIds` |  |
| `student.ell_status` | English learner status | Special status (5) | Special Indicator | `students.Ell status` |  | `ELL`<br>`LEP`<br>`EL`<br>`English Learner`<br>`EL Status`<br>`LEP Status` |
| `student.frl_status` | Free or reduced-price lunch status | Special status (5) | Special Indicator | `students.Frl status` |  | `Lunch Status`<br>`Free/Reduced Lunch`<br>`Free Reduced Lunch`<br>`FRL`<br>`Meal Status`<br>`Meal Eligibility`<br>`Lunch Eligibility` |
| `student.iep_status` | Individualized Education Program (IEP) status | Special status (5) | Special Indicator | `students.IEP status` |  | `IEP`<br>`IEP Status`<br>`Special Education`<br>`SPED`<br>`Special Ed` |
| `student.disability` | Disability status and type | Special status (5) | Special Indicator | `students.Disability status`<br>`students.Disability type` |  | `Primary Disability`<br>`Disability Code` |
| `student.section_504_status` | Section 504 plan status | Special status (5) | Special Indicator | `students.Section 504 status` |  | `504`<br>`504 Plan`<br>`Section 504` |
| `student.medical_alerts` | Medical alerts and health data | Special status (5) | Special Indicator |  |  | `Medical Alert`<br>`Medical Alerts`<br>`Health Alert`<br>`Medical Conditions` |
| `student.living_situation` | Living situation (homeless, foster care) | Special status (5) | Special Indicator |  |  | `Homeless`<br>`McKinney-Vento` |
| `student.gifted_status` | Gifted status | Academic and activity (3) | Student Program Membership | `students.Gifted status` |  | `Gifted`<br>`GT`<br>`Gifted and Talented` |
| `student.program_membership` | Academic or extracurricular program membership | Academic and activity (3) | Student Program Membership |  |  |  |
| `student.gpa` | Grade point average | Academic and activity (3) | Transcript | `students.Unweighted gpa`<br>`students.Weighted gpa` |  |  |
| `student.course_grades` | Course grades | Academic and activity (3) | Transcript |  |  |  |
| `student.assessment_results` | Assessment results | Academic and activity (3) | Assessment |  |  |  |
| `student.attendance` | Attendance | Academic and activity (3) | Attendance |  |  |  |
| `student.conduct` | Conduct and discipline records | Behavior and expression (4) | Conduct |  |  |  |
| `student.communications` | Messages and online communications | Behavior and expression (4) | Communications |  |  |  |
| `student.work` | Student work | Academic and activity (3) | Student Work |  |  |  |
| `student.survey_responses` | Survey responses | Behavior and expression (4) | Student Survey Responses |  |  |  |
| `student.in_app_performance` | Performance inside the app | Academic and activity (3) | Student In App Performance |  |  |  |
| `student.app_usage` | App usage statistics | Academic and activity (3) | Application Use Statistics |  |  |  |
| `student.device_metadata` | Device and network metadata (IP address, cookies) | Identifiers and contact (3) | Application Technology Meta Data |  |  |  |
| `student.transportation` | Transportation (bus route, stop) | Location (5) | Transportation |  |  | `Bus Route`<br>`Bus Stop`<br>`Bus Number`<br>`Bus` |

## Parent or guardian (5)

| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |
|---|---|---|---|---|---|---|
| `guardian.id` | Guardian ID | Identifiers and contact (3) | Parent/Guardian ID | `students.Contact sis id` | `users.sourcedId` |  |
| `guardian.name` | Guardian name | Identifiers and contact (3) | Parent/Guardian Name | `students.Contact name` | `users.givenName`<br>`users.middleName`<br>`users.familyName` | `Parent Name`<br>`Guardian Name`<br>`Parent/Guardian Name` |
| `guardian.relationship` | Relationship to the student | Identifiers and contact (3) | Parent/Guardian ID | `students.Contact type`<br>`students.Contact relationship` |  |  |
| `guardian.email` | Guardian email | Identifiers and contact (3) | Parent/Guardian Contact Information | `students.Contact email` | `users.email` | `Parent Email`<br>`Guardian Email` |
| `guardian.phone` | Guardian phone | Identifiers and contact (3) | Parent/Guardian Contact Information | `students.Contact phone`<br>`students.Contact phone type` | `users.phone`<br>`users.sms` | `Parent Phone`<br>`Guardian Phone` |

## Staff (16)

| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |
|---|---|---|---|---|---|---|
| `staff.id` | Staff ID (district system) | Identifiers and contact (3) |  | `teachers.Teacher id`<br>`staff.Staff id` | `users.sourcedId` | `Staff ID`<br>`Teacher ID`<br>`Employee ID` |
| `staff.staff_number` | Staff number | Identifiers and contact (3) |  | `teachers.Teacher number` | `users.identifier` |  |
| `staff.state_id` | State educator ID | Identifiers and contact (3) |  | `teachers.State teacher id` |  |  |
| `staff.first_name` | Staff first name | Identifiers and contact (3) |  | `teachers.First name`<br>`staff.First name` | `users.givenName` |  |
| `staff.middle_name` | Staff middle name | Identifiers and contact (3) |  | `teachers.Middle name` | `users.middleName` |  |
| `staff.last_name` | Staff last name | Identifiers and contact (3) |  | `teachers.Last name`<br>`staff.Last name` | `users.familyName` |  |
| `staff.full_name` | Staff full name | Identifiers and contact (3) |  | `schools.Principal` |  |  |
| `staff.email` | Staff email | Identifiers and contact (3) |  | `teachers.Teacher email`<br>`staff.Staff email`<br>`schools.Principal email` | `users.email` |  |
| `staff.phone` | Staff phone | Identifiers and contact (3) |  |  | `users.phone`<br>`users.sms` |  |
| `staff.username` | Staff username | Identifiers and contact (3) |  | `teachers.Username`<br>`staff.Username` | `users.username` |  |
| `staff.password` | Staff password | Credentials (5) |  | `teachers.Password`<br>`staff.Password` | `users.password` |  |
| `staff.title` | Job title | Organizational (1) |  | `teachers.Title`<br>`staff.Title` |  |  |
| `staff.department` | Department | Organizational (1) |  | `staff.Department` |  |  |
| `staff.role` | Staff role | Organizational (1) |  | `staff.Role` |  |  |
| `staff.school` | School where the staff member works | Organizational (1) |  | `teachers.School id`<br>`staff.School id` | `users.orgSourcedIds` |  |
| `staff.class_assignments` | Classes the staff member teaches | Organizational (1) |  | `sections.Teacher id`<br>`sections.Teacher 2 id`<br>`sections.Teacher 3 id`<br>`sections.Teacher 4 id`<br>`sections.Teacher 5 id`<br>`sections.Teacher 6 id`<br>`sections.Teacher 7 id`<br>`sections.Teacher 8 id`<br>`sections.Teacher 9 id`<br>`sections.Teacher 10 id` | `enrollments.classSourcedId` |  |

## School (6)

| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |
|---|---|---|---|---|---|---|
| `school.id` | School ID | Organizational (1) |  | `schools.School id` | `orgs.sourcedId` |  |
| `school.name` | School name | Organizational (1) |  | `schools.School name` | `orgs.name` |  |
| `school.number` | School number | Organizational (1) |  | `schools.School number` | `orgs.identifier` |  |
| `school.state_id` | State school ID | Organizational (1) |  | `schools.State id` |  |  |
| `school.contact` | School address and phone | Organizational (1) |  | `schools.School address`<br>`schools.School city`<br>`schools.School state`<br>`schools.School zip`<br>`schools.School phone` |  |  |
| `school.grade_range` | Grades served | Organizational (1) |  | `schools.Low grade`<br>`schools.High grade` |  |  |

## Class section (9)

| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |
|---|---|---|---|---|---|---|
| `section.id` | Section ID | Organizational (1) |  | `sections.Section id` | `classes.sourcedId` |  |
| `section.name` | Section name | Organizational (1) |  | `sections.Name` | `classes.title` |  |
| `section.number` | Section number | Organizational (1) |  | `sections.Section number` | `classes.classCode` |  |
| `section.course` | Course | Organizational (1) |  | `sections.Course name`<br>`sections.Course number`<br>`sections.Course description` | `classes.courseSourcedId` |  |
| `section.subject` | Subject | Organizational (1) |  | `sections.Subject` | `classes.subjects`<br>`classes.subjectCodes` |  |
| `section.grade` | Section grade level | Organizational (1) |  | `sections.Grade` | `classes.grades` |  |
| `section.period` | Period | Organizational (1) |  | `sections.Period` | `classes.periods` |  |
| `section.term` | Term | Organizational (1) |  | `sections.Term name`<br>`sections.Term start`<br>`sections.Term end` | `classes.termSourcedIds` |  |
| `section.location` | Room or location | Organizational (1) |  |  | `classes.location` |  |
