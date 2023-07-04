import { gql } from "@apollo/client";

export const DELETE_MANY_POSTS = gql`
  mutation DeleteManyPosts($query: PostQueryInput) {
    deleteManyPosts(query: $query) {
      deletedCount
    }
  }
`;

export const DELETE_ONE_POST = gql`
  mutation DeleteOnePost($query: PostQueryInput!) {
    deleteOnePost(query: $query) {
      authorId
      content
      images
      postType
    }
  }
`;

export const INSERT_ONE_POST = gql`
  mutation InsertOnePost($data: PostInsertInput!) {
    insertOnePost(data: $data) {
      authorId
      content
      images
      postType
      postedAt
    }
  }
`;

export const UPDATE_MANY_POSTS = gql`
  mutation UpdateManyPosts($query: PostQueryInput, $set: PostUpdateInput!) {
    updateManyPosts(query: $query, set: $set) {
      matchedCount
      modifiedCount
    }
  }
`;

export const UPDATE_ONE_POST = gql`
  mutation UpdateOnePost($query: PostQueryInput, $set: PostUpdateInput!) {
    updateOnePost(query: $query, set: $set) {
      authorId
      content
      images
      postType
    }
  }
`;

export const POST = gql`
  query Post($query: PostQueryInput) {
    post(query: $query) {
      authorId
      content
      images
      postType
    }
  }
`;

export const POSTS = gql`
  query Posts(
    $query: PostQueryInput
    $limit: Int = 100
    $sortBy: PostSortByInput
  ) {
    posts(query: $query, limit: $limit, sortBy: $sortBy) {
      authorId
      content
      images
      postType
    }
  }
`;
