# Migration history

The eighteen timestamped migration files in this folder match the remote migration history recorded by the linked Supabase project. Keep each 14-digit timestamp unchanged so local and remote migration histories remain aligned.

The current online application includes the reviewed schema changes for the existing live schema, Faculty & Employee Management, and Student Management operations (admission lifecycle, linked guardian contacts, class placements, private student documents and audit history for attendance, published results, assignment submissions, guardian policy consolidation and activity indexes). The Student Management and Faculty/Employee migrations have already been applied to the linked project; do not replay them manually.

The older numbered SQL files are preserved as legacy project material. Do not execute them blindly against the existing production database: parts of their schema are already present with different legacy column names. Reconcile the remote migration history before any future schema deployment.


The institutional platform expansion adds campuses, a typed institution-scoped operational record layer with immutable audit events, approval and data-transfer queues, bulk attendance registers, device-source registry, class coverage, library circulation, inventory movements, student transport allocations, payroll runs/items and institution settings. The bulk attendance RPC is invoker-security and uses the active member's institution plus existing row-level security. Device-based attendance is registered as not configured until a real provider feed is connected.

The institutional policy refinement consolidates permissive SELECT policies, limits teacher-visible employee records to the signed-in employee, adds institution-scoped leave-to-class-cover references, and adds foreign-key indexes for the new institutional tables.

The campus-scope migration adds an institution-scoped campus reference to the existing student, faculty, academic, finance, assessment, communication and operations tables, preserves existing unassigned records, and adds an atomic stock-movement function that prevents negative stock. A follow-up fixes the row-count check in that function.


The announcement read-receipts migration adds per-user read state for published institution announcements. Its row-level security only permits an authenticated user with an active institution membership to read or update their own receipt; there is no client DELETE grant. The Notification Centre uses those receipts to display unread totals and mark individual or all visible announcements as read.


A follow-up performance migration adds the missing lookup index for announcement receipt user IDs and removes the redundant fee-payment SELECT policy. The surviving fee-payment policy includes the same owner/admin/accountant grant and additionally permits linked student/guardian visibility through the student-access check, so the redundant policy was a strict subset.
