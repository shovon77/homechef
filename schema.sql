-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

'SQL'

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.chef_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  location text,
  short_bio text,
  experience text,
  cuisine_specialty text,
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  notes text,
  CONSTRAINT chef_applications_pkey PRIMARY KEY (id),
  CONSTRAINT chef_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT chef_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.chef_ratings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  chef_id bigint NOT NULL,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chef_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT chef_ratings_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.chefs(id)
);
CREATE TABLE public.chef_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  chef_id bigint NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT chef_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT chef_reviews_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.chefs(id),
  CONSTRAINT chef_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chefs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  location text,
  bio text,
  photo text,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  phone text,
  status text DEFAULT 'pending'::text,
  rating numeric,
  rating_count integer,
  CONSTRAINT chefs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dish_ratings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dish_id bigint NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  user_id uuid,
  comment text,
  CONSTRAINT dish_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT dish_ratings_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id),
  CONSTRAINT dish_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.dishes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  chef text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  category text,
  image text DEFAULT 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&q=80'::text,
  created_at timestamp with time zone DEFAULT now(),
  featured boolean DEFAULT false,
  description text,
  thumbnail text,
  chef_id bigint,
  CONSTRAINT dishes_pkey PRIMARY KEY (id),
  CONSTRAINT dishes_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.chefs(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  dish_id integer,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.dishes(id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'completed'::text, 'cancelled'::text])),
  total_cents integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  name text,
  role text DEFAULT 'user'::text,
  is_chef boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text UNIQUE,
  name text,
  is_chef boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
SQL