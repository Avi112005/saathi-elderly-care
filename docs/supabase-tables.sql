-- Creates all Saathi tables in the "saathi" schema. Paste into Supabase → SQL Editor → Run.
-- (Alternative to `npm run remote:setup`, which also loads the demo circle.)
CREATE SCHEMA IF NOT EXISTS "saathi";
SET search_path TO "saathi";


-- CreateTable
CREATE TABLE "CareProfile" (
    "id" TEXT NOT NULL,
    "careCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "conditions" TEXT NOT NULL DEFAULT '',
    "allergies" TEXT NOT NULL DEFAULT '',
    "bloodGroup" TEXT,
    "emergencyContact" TEXT,
    "primaryDoctor" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "consentMode" BOOLEAN NOT NULL DEFAULT true,
    "reminderLeadMin" INTEGER NOT NULL DEFAULT 15,
    "nudgeAfterMin" INTEGER NOT NULL DEFAULT 30,
    "escalateAfterMin" INTEGER NOT NULL DEFAULT 120,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "relationship" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "passcodeHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "avatarColor" TEXT NOT NULL DEFAULT 'sky',
    "emailDoseReminders" BOOLEAN NOT NULL DEFAULT true,
    "emailMissedDoses" BOOLEAN NOT NULL DEFAULT true,
    "emailAppointments" BOOLEAN NOT NULL DEFAULT true,
    "emailRefills" BOOLEAN NOT NULL DEFAULT true,
    "emailDailyDigest" BOOLEAN NOT NULL DEFAULT false,
    "emailVitalAlerts" BOOLEAN NOT NULL DEFAULT true,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT NOT NULL DEFAULT '',
    "form" TEXT NOT NULL DEFAULT 'TABLET',
    "doseQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "doseUnit" TEXT NOT NULL DEFAULT 'tablet',
    "times" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "foodTiming" TEXT NOT NULL DEFAULT 'ANY',
    "instructions" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT '',
    "prescriber" TEXT NOT NULL DEFAULT '',
    "appearance" TEXT NOT NULL DEFAULT '',
    "pillColor" TEXT NOT NULL DEFAULT 'white',
    "stockCount" DOUBLE PRECISION,
    "refillAt" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ACTIVITY',
    "times" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "value" DOUBLE PRECISION,
    "flag" TEXT NOT NULL DEFAULT 'NORMAL',
    "note" TEXT NOT NULL DEFAULT '',
    "loggedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT NOT NULL DEFAULT '',
    "questions" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "outcome" TEXT NOT NULL DEFAULT '',
    "transport" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "medicationId" TEXT,
    "payload" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "memberId" TEXT,
    "toEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareProfile_careCode_key" ON "CareProfile"("careCode");

-- CreateIndex
CREATE INDEX "Member_profileId_idx" ON "Member"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_codeHash_key" ON "Invite"("codeHash");

-- CreateIndex
CREATE INDEX "Invite_profileId_idx" ON "Invite"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_memberId_idx" ON "Session"("memberId");

-- CreateIndex
CREATE INDEX "Medication_profileId_active_idx" ON "Medication"("profileId", "active");

-- CreateIndex
CREATE INDEX "DoseLog_profileId_scheduledFor_idx" ON "DoseLog"("profileId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "DoseLog_medicationId_scheduledFor_key" ON "DoseLog"("medicationId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Routine_profileId_active_idx" ON "Routine"("profileId", "active");

-- CreateIndex
CREATE INDEX "RoutineLog_profileId_scheduledFor_idx" ON "RoutineLog"("profileId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineLog_routineId_scheduledFor_key" ON "RoutineLog"("routineId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Appointment_profileId_startsAt_idx" ON "Appointment"("profileId", "startsAt");

-- CreateIndex
CREATE INDEX "ChangeRequest_profileId_status_idx" ON "ChangeRequest"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_profileId_createdAt_idx" ON "Notification"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_profileId_createdAt_idx" ON "ActivityLog"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseLog" ADD CONSTRAINT "DoseLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseLog" ADD CONSTRAINT "DoseLog_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseLog" ADD CONSTRAINT "DoseLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

