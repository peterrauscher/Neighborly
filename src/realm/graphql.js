import { gql } from "@apollo/client";

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
      neighborhood {
        label
        placeId
      }
    }
  }
`;

export const POST = gql`
  query Post($query: PostQueryInput) {
    post(query: $query) {
      authorId
      neighborhood {
        label
        placeId
      }
      content
      images
      postType
      postedAt
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
      neighborhood {
        label
        placeId
      }
      content
      images
      postType
      postedAt
    }
  }
`;
