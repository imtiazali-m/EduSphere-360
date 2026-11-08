# EduSphere 360 — Owner Manual
*Describes what the Stage 5 source implements. Items marked (not verified) have not been tested against the live system.*

## 1. Registering your institution
Use the public welcome page → register as institution owner → enter institution details → confirm the verification email (a resend option is available). Owner membership is activated through Supabase.

## 2. Logging in
Use the login page (role-specific paths exist). "Remember me" controls session persistence. Expired sessions prompt you to sign in again.

## 3. Your workspace
Navigation groups: Dashboard, Administration (Departments, Programs, Classes & Sections, Academic Sessions, Subjects, Rooms & Facilities), Students, Faculty & Staff, Attendance, Examinations (Examinations, Exam Results), Fees & Payments, Teaching & Learning (Assignments, Submissions), Timetable, Communication (Announcements), User Accounts, Files & Documents, Work Management.

## 4. Administration
Create, edit and delete records in each administration register. Records are scoped to your institution by Supabase Row Level Security.

## 5. User management
"User Accounts" creates and lists staff, student and parent accounts (uses the create-user Edge Function). Assign roles carefully: owner and administrator are the only roles with institution-wide write access.

## 6. Reports
The current release provides dashboard summaries and table views per module. Dedicated exportable report pages are not implemented.

## 7. Security
Data is isolated per institution. Files are stored in a private bucket. Never share the service-role key; the application only uses the publishable key.
