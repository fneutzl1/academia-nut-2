-- CreateEnum
CREATE TYPE "CatalogYearStatus" AS ENUM ('OPEN', 'COMPLETE');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('IMPORT', 'PULL', 'MANUAL');

-- CreateTable
CREATE TABLE "CatalogYear" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "status" "CatalogYearStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseIdentifier" (
    "id" SERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVersion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "catalogYearId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creditsMin" DOUBLE PRECISION NOT NULL,
    "creditsMax" DOUBLE PRECISION,
    "offeredAutumn" BOOLEAN NOT NULL,
    "offeredSpring" BOOLEAN NOT NULL,
    "offeredSummer" BOOLEAN NOT NULL,
    "offeredOnDemand" BOOLEAN NOT NULL,
    "deptFee" DOUBLE PRECISION,
    "techFee" DOUBLE PRECISION,
    "totalFee" DOUBLE PRECISION,
    "beginDate" TEXT NOT NULL,
    "requisites" JSONB NOT NULL,
    "restrictions" JSONB NOT NULL,
    "contactHours" JSONB NOT NULL,
    "syllabus" JSONB,
    "contentHash" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL,
    "sourceId" TEXT,
    "sourceRunId" TEXT,
    "pulledAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentIdentifier" (
    "id" SERIAL NOT NULL,
    "departmentId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentVersion" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "catalogYearId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "link" TEXT,
    "subDepartments" TEXT[],
    "programIds" TEXT[],
    "contentHash" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL,
    "sourceId" TEXT,
    "sourceRunId" TEXT,
    "pulledAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectVersion" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "catalogYearId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL,
    "sourceId" TEXT,
    "sourceRunId" TEXT,
    "pulledAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" BIGSERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "catalogYearId" INTEGER,
    "action" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL,
    "actor" TEXT,
    "sourceRunId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogYear_code_key" ON "CatalogYear"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogYear_startYear_key" ON "CatalogYear"("startYear");

-- CreateIndex
CREATE INDEX "CourseIdentifier_courseId_idx" ON "CourseIdentifier"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseIdentifier_system_value_key" ON "CourseIdentifier"("system", "value");

-- CreateIndex
CREATE INDEX "CourseVersion_catalogYearId_subject_idx" ON "CourseVersion"("catalogYearId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_courseId_catalogYearId_key" ON "CourseVersion"("courseId", "catalogYearId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_catalogYearId_courseCode_key" ON "CourseVersion"("catalogYearId", "courseCode");

-- CreateIndex
CREATE INDEX "DepartmentIdentifier_departmentId_idx" ON "DepartmentIdentifier"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentIdentifier_system_value_key" ON "DepartmentIdentifier"("system", "value");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentVersion_departmentId_catalogYearId_key" ON "DepartmentVersion"("departmentId", "catalogYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectVersion_subjectId_catalogYearId_key" ON "SubjectVersion"("subjectId", "catalogYearId");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_catalogYearId_idx" ON "ChangeLog"("catalogYearId");

-- AddForeignKey
ALTER TABLE "CourseIdentifier" ADD CONSTRAINT "CourseIdentifier_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentIdentifier" ADD CONSTRAINT "DepartmentIdentifier_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentVersion" ADD CONSTRAINT "DepartmentVersion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentVersion" ADD CONSTRAINT "DepartmentVersion_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectVersion" ADD CONSTRAINT "SubjectVersion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectVersion" ADD CONSTRAINT "SubjectVersion_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
