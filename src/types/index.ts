export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  ingredients: string[];
  instructions: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  category: RecipeCategory;
  difficulty: Difficulty;
  rating: number | null;
  is_favorite: boolean;
  image_url: string | null;
  source_url: string | null;
  source_type: RecipeSourceType;
  created_at: string;
  updated_at: string;
}

export type RecipeSourceType = 'image' | 'url' | 'manual';

export type RecipeCategory =
  | 'starter'
  | 'main'
  | 'dessert'
  | 'side'
  | 'breakfast'
  | 'snack';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedRecipe {
  title: string;
  ingredients: string[];
  instructions: string;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  category: RecipeCategory;
  difficulty: Difficulty;
  confidence: number;
  image_url?: string | null;
  source_url?: string | null;
  source_type: 'image' | 'url';
}

export type SortOption = 'newest' | 'oldest' | 'prep_time' | 'rating';
export type LibraryCategoryFilter = 'all' | RecipeCategory;
