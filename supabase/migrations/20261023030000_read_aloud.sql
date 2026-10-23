-- Private, expiring audio; never exposed through the public Supabase client.
CREATE TABLE IF NOT EXISTS public.speech_audio (
  id varchar(64) PRIMARY KEY,
  user_id varchar(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id varchar(36) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id varchar(36) REFERENCES public.messages(id) ON DELETE CASCADE,
  source json NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  audio json,
  expires_at varchar(40) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_speech_audio_user_id ON public.speech_audio(user_id);
CREATE INDEX IF NOT EXISTS ix_speech_audio_conversation_id ON public.speech_audio(conversation_id);
CREATE INDEX IF NOT EXISTS ix_speech_audio_expires_at ON public.speech_audio(expires_at);
CREATE TABLE IF NOT EXISTS public.speech_usage (
  id varchar(64) PRIMARY KEY,
  day varchar(10) NOT NULL,
  characters integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0
);
ALTER TABLE public.speech_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.speech_audio, public.speech_usage FROM anon, authenticated, service_role;
