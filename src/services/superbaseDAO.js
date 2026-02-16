

import { supabase } from '../config/supabase';

/**
 * Upload image to Supabase Storage
 */
export const uploadImage = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from('dao-images')
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('dao-images')
    .getPublicUrl(filePath);

  return publicUrl;
};

/**
 * Create a new post
 */
export const createPost = async ({ text, image, userId, author }) => {
  let imageUrl = null;

  // Upload image if provided
  if (image) {
    imageUrl = await uploadImage(image);
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        user_id: userId,
        author: author,
        text: text,
        image: imageUrl,
        likes: 0,
        liked_by: []
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get all posts (newest first)
 */
export const getPosts = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Format for frontend
  return data.map(post => ({
    ...post,
    timeString: formatTimeString(post.created_at),
    comments: [] // Will be loaded separately
  }));
};

/**
 * Toggle like on a post
 */
export const togglePostLike = async (postId, userId) => {
  // Get current post
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('liked_by, likes')
    .eq('id', postId)
    .single();

  if (fetchError) throw fetchError;

  const likedBy = post.liked_by || [];
  const hasLiked = likedBy.includes(userId);

  // Update post
  const { data, error } = await supabase
    .from('posts')
    .update({
      likes: hasLiked ? post.likes - 1 : post.likes + 1,
      liked_by: hasLiked
        ? likedBy.filter(id => id !== userId)
        : [...likedBy, userId]
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Create a comment (with nested support)
 */
export const createComment = async ({ postId, userId, author, text, parentId = null }) => {
  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        post_id: postId,
        parent_id: parentId,
        user_id: userId,
        author: author,
        text: text,
        likes: 0,
        liked_by: []
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get comments for a post (with nested structure)
 */
export const getComments = async (postId) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Build nested structure
  const commentMap = {};
  const rootComments = [];

  data.forEach(comment => {
    commentMap[comment.id] = {
      ...comment,
      replies: [],
      timeString: formatTimeString(comment.created_at)
    };
  });

  data.forEach(comment => {
    if (comment.parent_id) {
      if (commentMap[comment.parent_id]) {
        commentMap[comment.parent_id].replies.push(commentMap[comment.id]);
      }
    } else {
      rootComments.push(commentMap[comment.id]);
    }
  });

  return rootComments;
};

/**
 * Toggle like on a comment
 */
export const toggleCommentLike = async (commentId, userId) => {
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('liked_by, likes')
    .eq('id', commentId)
    .single();

  if (fetchError) throw fetchError;

  const likedBy = comment.liked_by || [];
  const hasLiked = likedBy.includes(userId);

  const { data, error } = await supabase
    .from('comments')
    .update({
      likes: hasLiked ? comment.likes - 1 : comment.likes + 1,
      liked_by: hasLiked
        ? likedBy.filter(id => id !== userId)
        : [...likedBy, userId]
    })
    .eq('id', commentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Subscribe to real-time post updates
 */
export const subscribeToPostsChannel = (callback) => {
  const channel = supabase
    .channel('posts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Subscribe to real-time comment updates
 */
export const subscribeToCommentsChannel = (postId, callback) => {
  const channel = supabase
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'comments',
        filter: `post_id=eq.${postId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Helper: Format timestamp
 */
const formatTimeString = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
  return date.toLocaleDateString();
};