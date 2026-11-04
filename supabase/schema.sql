-- ==============================================================================
-- TECHNOSAVVYS WORKSHOP MANAGEMENT SYSTEM (WMS)
-- Database Schema, Constraints, Indexes & Row Level Security (RLS)
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workshop_status AS ENUM ('Upcoming', 'Ongoing', 'Completed', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'Present', 'Absent', 'Late', 'Excused', 'CERTIFICATE_ELIGIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE check_in_method AS ENUM ('QR Scan', 'Manual', 'RFID', 'Biometric');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE certificate_grade AS ENUM ('Distinction', 'Merit', 'Pass');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE certificate_status AS ENUM ('Issued', 'Pending', 'Revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. PROFILES & ROLE-BASED ACCESS CONTROL (RBAC)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. WORKSHOPS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Web Dev', 'AI & ML', 'Cloud Computing', 'Cybersecurity', 'Data Science', 'IoT & Robotics')),
    trainer TEXT NOT NULL,
    trainer_role TEXT NOT NULL DEFAULT 'Lead Instructor',
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    description TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    status workshop_status NOT NULL DEFAULT 'Upcoming',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. WORKSHOP SESSIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workshop_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    session_title TEXT NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT NOT NULL DEFAULT 'Virtual Lab / Innovation Hub',
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. STUDENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    reg_no TEXT NOT NULL UNIQUE,
    college TEXT NOT NULL,
    batch TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. STUDENT WORKSHOP ENROLLMENTS (Duplicate Prevention)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'Enrolled' CHECK (status IN ('Enrolled', 'Completed', 'Dropped')),
    CONSTRAINT uq_student_workshop UNIQUE (student_id, workshop_id)
);

-- ==============================================================================
-- 8. ATTENDANCE TABLE (Session + Student Duplicate Prevention)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'Present',
    check_in_method check_in_method NOT NULL DEFAULT 'Manual',
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_session_student_attendance UNIQUE (session_id, student_id)
);

-- ==============================================================================
-- 9. CERTIFICATES TABLE (Unique per Student per Workshop & Verification Hash)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_no TEXT NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE RESTRICT,
    trainer_name TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    grade certificate_grade NOT NULL DEFAULT 'Distinction',
    status certificate_status NOT NULL DEFAULT 'Issued',
    score NUMERIC(5, 2) CHECK (score >= 0 AND score <= 100),
    verification_hash TEXT NOT NULL UNIQUE,
    storage_path TEXT,
    file_name TEXT,
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_workshop_certificate UNIQUE (student_id, workshop_id)
);

-- ==============================================================================
-- 9B. PRIVATE SUPABASE STORAGE BUCKET (CERTIFICATES)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'certificates',
    'certificates',
    false, -- STRICTLY PRIVATE STORAGE
    10485760, -- Max 10MB per file
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

-- Storage RLS: Admins have full access, authenticated students can read their own certificate
CREATE POLICY "Admins full access on certificates bucket"
    ON storage.objects FOR ALL
    USING (bucket_id = 'certificates' AND public.is_admin())
    WITH CHECK (bucket_id = 'certificates' AND public.is_admin());

CREATE POLICY "Students can read their own certificate PDF"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'certificates' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ==============================================================================
-- 10. AUDIT LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 11. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_workshops_status ON public.workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_category ON public.workshops(category);
CREATE INDEX IF NOT EXISTS idx_sessions_workshop_id ON public.workshop_sessions(workshop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.workshop_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_students_reg_no ON public.students(reg_no);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_workshop ON public.student_enrollments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);
CREATE INDEX IF NOT EXISTS idx_certificates_no ON public.certificates(certificate_no);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_hash ON public.certificates(verification_hash);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if caller has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT (role = 'admin')
        FROM public.profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role
        FROM public.profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Admins full access on profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin() OR auth.uid() = id);

-- WORKSHOPS POLICIES
CREATE POLICY "Public and users can view published workshops"
    ON public.workshops FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage workshops"
    ON public.workshops FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- SESSIONS POLICIES
CREATE POLICY "Public can view sessions"
    ON public.workshop_sessions FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage sessions"
    ON public.workshop_sessions FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- STUDENTS POLICIES
CREATE POLICY "Admins can view and manage all students"
    ON public.students FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Students can view their own record"
    ON public.students FOR SELECT
    USING (user_id = auth.uid());

-- ENROLLMENTS POLICIES
CREATE POLICY "Admins can manage all enrollments"
    ON public.student_enrollments FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Students can view their enrollments"
    ON public.student_enrollments FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )
    );

-- ATTENDANCE POLICIES
CREATE POLICY "Admins can view and mark attendance"
    ON public.attendance FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Students can view their attendance logs"
    ON public.attendance FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )
    );

-- CERTIFICATES POLICIES
CREATE POLICY "Public can verify valid certificates by serial no"
    ON public.certificates FOR SELECT
    USING (status = 'Issued');

CREATE POLICY "Admins can issue and manage certificates"
    ON public.certificates FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "System can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

-- ==============================================================================
-- 13. AUTOMATIC PROFILE CREATION TRIGGER (AUTH HOOK)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'::user_role)
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 14. AUTHORIZED SUPER-ADMIN & TEST STUDENT SEED
-- ==============================================================================
-- Test Student: Ram (Phone: 8960627330, Batch: TEST, strictly zero fake attendance)
INSERT INTO public.students (id, name, email, phone, reg_no, college, batch, status)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'::uuid,
    'Ram',
    'ram.test@technosavvys.edu',
    '8960627330',
    'TS-TEST-8960',
    'Technosavvys Academy (Verification)',
    'TEST',
    'Active'
)
ON CONFLICT (email) DO UPDATE
SET phone = EXCLUDED.phone,
    name = EXCLUDED.name,
    batch = EXCLUDED.batch;


