-- Clean up previous failed attempts
drop trigger if exists set_updated_at on public.achievements;
drop trigger if exists handle_updated_at on public.achievements;
drop function if exists public.handle_updated_at();
drop policy if exists "Users can view their own achievements" on public.achievements;
drop policy if exists "Users can insert their own achievements" on public.achievements;
drop policy if exists "Users can update their own achievements" on public.achievements;
drop policy if exists "Users can delete their own achievements" on public.achievements;
drop table if exists public.achievements;

-- Create achievements table
create table public.achievements (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    date_year text,
    organization text,
    credential_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.achievements enable row level security;

-- Policies for achievements
create policy "Users can view their own achievements"
    on public.achievements for select
    using ( auth.uid() = user_id );

create policy "Users can insert their own achievements"
    on public.achievements for insert
    with check ( auth.uid() = user_id );

create policy "Users can update their own achievements"
    on public.achievements for update
    using ( auth.uid() = user_id )
    with check ( auth.uid() = user_id );

create policy "Users can delete their own achievements"
    on public.achievements for delete
    using ( auth.uid() = user_id );

-- Create trigger function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger set_updated_at
    before update on public.achievements
    for each row
    execute function public.handle_updated_at();
