create policy "Users can insert posts"
on posts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Anyone can read posts"
on posts for select
to anon, authenticated
using (true);

create policy "Users can insert likes"
on likes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Anyone can read likes"
on likes for select
to anon, authenticated
using (true);

create policy "Users can delete own likes"
on likes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert follows"
on follows for insert
to authenticated
with check (auth.uid() = follower_id);

create policy "Users can delete own follows"
on follows for delete
to authenticated
using (auth.uid() = follower_id);

create policy "Anyone can read profiles"
on profiles for select
to anon, authenticated
using (true);

create policy "Users can insert own profile"
on profiles for insert
to authenticated
with check (auth.uid() = id);
