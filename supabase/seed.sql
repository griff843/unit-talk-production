-- === Seed Pros (ebooks) ===
insert into public.ebooks (title, author) values
  ('Henry','Henry'),
  ('Cobo','Cobo'),
  ('Kiv','Kiv'),
  ('Abram','Abram'),
  ('Geezy','Geezy'),
  ('Jonbeast','Jonbeast')
on conflict (title) do nothing;

-- === Seed Formations ===
insert into public.formations (name, aliases) values
  ('Bunch X Nasty',        array['Bunch XN','Bunch Nasty']),
  ('Doubles Y Flex Close', array['DY Flex Close','Dbl Y Flex Close']),
  ('Trips TE',             array['Trips TE','Trips Tight End']),
  ('Gun Bunch Strong',     array['Bunch Strong','Gun Bunch Strong']),
  ('Tight Doubles',        array['Tight Doubles','Gun Tight Doubles']),
  ('Tight Y Off Wk',       array['Tight Y Off Wk','Gun Tight Y Off Weak']),
  ('Y Off Trio Wk',        array['Y Off Trio Wk','Gun Y Off Trio Weak']),
  ('Y Off Trio Close',     array['Y Off Trio Close','Y Off Trio CL']),
  ('Singleback Y Off Flex',array['Singleback Y Off Flex','SBO Y Off Flex']),
  ('Bunch TE',             array['Bunch TE','Gun Bunch TE']),
  ('Redzone',              array['RZ','Goal Line','Redzone Package'])
on conflict (name) do nothing;
