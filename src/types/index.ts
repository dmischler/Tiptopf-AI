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
  tags: string[];
  notes?: string;
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

export interface AppSettings {
  opencode_api_key: string | null;
  opencode_base_url: string | null;
  opencode_model_id: string | null;
  gemini_api_key: string | null;
  gemini_base_url: string | null;
  gemini_model_id: string | null;
  gemini_fallback_model_id: string | null;
  pexels_api_key: string | null;
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
  tags?: string[];
}

export type SortOption = 'newest' | 'oldest' | 'prep_time' | 'rating';

export interface Collection {
  id: string;
  name: string;
  recipe_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  text: string;
  checked: boolean;
  sourceRecipeTitle?: string;
  sourceServings?: number;
  addedAt: string;
}
