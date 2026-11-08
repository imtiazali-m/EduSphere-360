# EduSphere 360 — Penpot UI/UX Design Brief

## Brand direction

- Product: EduSphere 360
- Positioning: connected education management for schools, colleges and universities
- Tone: dependable, clear, calm, modern, accessible
- Primary color: navy `#102D4D`
- Primary action: blue `#2F6FE4`
- Background: `#F4F7FB`
- Surface: `#FFFFFF`
- Main text: `#17283E`
- Muted text: `#718096`
- Border: `#E7EDF4`
- Success: `#1B9A70`
- Warning: `#C58A2C`
- Danger: `#B94B42`
- Typography: Manrope for headings; DM Sans for body text
- Spacing system: 4, 8, 12, 16, 20, 24, 32, 40, 48
- Corner radius: 8 / 10 / 12 / 16

## Penpot pages and frames

Create these Penpot pages:

1. `00 - Brand & Tokens`
2. `01 - Public Website`
3. `02 - Authentication`
4. `03 - Admin Workspace`
5. `04 - Teacher Portal`
6. `05 - Student Portal`
7. `06 - Parent Portal`
8. `07 - Mobile Responsive`

Suggested desktop artboard: 1440 × 900. Suggested mobile artboard: 390 × 844.

## Screens to design

### Public website
- Header: brand, Login
- Hero: headline, explanation, Create your institution CTA
- Portal cards: Administrator, Teacher, Student, Parent
- Footer: workspace mode selector and platform information

### First-time setup
- Institution name and type
- Owner name, email and password
- Online mode only: one-time bootstrap secret field
- Security explanation: only first owner setup is public; later accounts are administrator-created

### Login
- Role selector
- Email and password
- Sign in action
- Visible connection state: Online cloud workspace; show an internet-required state when disconnected

### Admin workspace
- Fixed desktop sidebar, collapsible mobile sidebar
- Institution switcher / institution identity
- Dashboard metric cards
- Student, faculty, attendance, exams, fees, assignments, timetable, announcements
- User account creation
- Private document centre

### Teacher workspace
- Assigned classes / subjects
- Attendance actions
- Exams and assignments
- Timetable and announcements

### Student workspace
- Personal academic summary
- Attendance, exams, fees, assignments, timetable and announcements

### Parent workspace
- Linked child selector (future multi-child refinement)
- Attendance, academic progress, fees and announcements

## Components

- Brand lockup and product mark
- Main and secondary buttons
- Portal cards
- Metric cards
- Sidebar navigation item (default, hover, active)
- Top navigation and profile menu
- Table (loading, empty, populated)
- Search field
- Status pills
- Form controls (text, email, password, date, number, select, textarea)
- Modal dialog
- Toast notifications (success/error)
- File upload row

## Interaction notes

- Portal login must validate the user's actual role after authentication; a portal selector does not grant permissions.
- Hide edit actions from read-only roles, but rely on database policies for real security.
- Display empty, loading and error states for every data module.
- On mobile, collapse the sidebar into a drawer.
- Use visible labels; do not rely on placeholder text alone.
- Status must not be communicated by color alone. Include text labels.
