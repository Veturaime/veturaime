-- VeturaIme Enhanced Schema Migration
-- Adds verification codes table and enhances cars table with additional vehicle data

-- =====================================================
-- 1. VERIFICATION CODES TABLE
-- Stores one-time verification codes for email verification
-- =====================================================

CREATE TABLE IF NOT EXISTS public.verification_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code varchar(6) NOT NULL,
    purpose varchar(50) NOT NULL DEFAULT 'email_verification',
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by user and code
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON public.verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON public.verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON public.verification_codes(expires_at);

-- RLS policies for verification_codes
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verification codes
CREATE POLICY "Users can view their own verification codes"
    ON public.verification_codes
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert verification codes for themselves
CREATE POLICY "Users can create their own verification codes"
    ON public.verification_codes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update (mark as used) their own verification codes
CREATE POLICY "Users can update their own verification codes"
    ON public.verification_codes
    FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- 2. ENHANCE PROFILES TABLE
-- Add email_verified_at column
-- =====================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Add car_selection_completed_at to track if user has completed car setup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS car_selection_completed_at timestamptz;

-- =====================================================
-- 3. ENHANCE CARS TABLE
-- Add additional vehicle identification and image fields
-- =====================================================

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS fuel_type varchar(50);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS transmission varchar(50);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS body_type varchar(50);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS engine_size varchar(20);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS horsepower integer;

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS usage_type varchar(50);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS purchase_date date;

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS purchase_price numeric(12, 2);

ALTER TABLE public.cars 
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- =====================================================
-- 4. DOCUMENT TYPES ENHANCEMENT
-- Add file_url for actual document uploads
-- =====================================================

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS file_url text;

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS reminder_days integer DEFAULT 30;

-- =====================================================
-- 5. FUNCTION: Generate verification code
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_verification_code(p_user_id uuid)
RETURNS varchar(6)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code varchar(6);
BEGIN
    -- Generate a 6-digit code
    v_code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    
    -- Invalidate any existing unused codes for this user
    UPDATE public.verification_codes
    SET used_at = now()
    WHERE user_id = p_user_id 
    AND used_at IS NULL
    AND purpose = 'email_verification';
    
    -- Insert the new code (expires in 10 minutes)
    INSERT INTO public.verification_codes (user_id, code, purpose, expires_at)
    VALUES (p_user_id, v_code, 'email_verification', now() + interval '10 minutes');
    
    RETURN v_code;
END;
$$;

-- =====================================================
-- 6. FUNCTION: Verify code
-- =====================================================

CREATE OR REPLACE FUNCTION public.verify_code(p_user_id uuid, p_code varchar(6))
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_valid boolean := false;
BEGIN
    -- Check if the code is valid
    UPDATE public.verification_codes
    SET used_at = now()
    WHERE user_id = p_user_id 
    AND code = p_code
    AND used_at IS NULL
    AND expires_at > now()
    AND purpose = 'email_verification'
    RETURNING true INTO v_valid;
    
    -- If valid, update the profile
    IF v_valid THEN
        UPDATE public.profiles
        SET email_verified_at = now()
        WHERE id = p_user_id;
    END IF;
    
    RETURN COALESCE(v_valid, false);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_verification_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_code(uuid, varchar) TO authenticated;

-- =====================================================
-- 7. CLEANUP: Function to remove expired codes
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.verification_codes
    WHERE expires_at < now() - interval '1 day';
END;
$$;
