-- Fixed public welcome speech has no conversation or transcript dependency.
CREATE TABLE IF NOT EXISTS public.welcome_speech_audio (
  id varchar(64) PRIMARY KEY,
  user_id varchar(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  variant varchar(32) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  audio json,
  expires_at varchar(40) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_welcome_speech_audio_user_id ON public.welcome_speech_audio(user_id);
CREATE INDEX IF NOT EXISTS ix_welcome_speech_audio_expires_at ON public.welcome_speech_audio(expires_at);
ALTER TABLE public.welcome_speech_audio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.welcome_speech_audio FROM PUBLIC, anon, authenticated, service_role;
