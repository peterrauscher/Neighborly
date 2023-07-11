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
        placeId
      }
    }
  }
`;

export const POSTS = gql`
  query GetPostsWithAuthors($placeId: String!, $postType: String) {
    postsWithAuthors(input: { placeId: $placeId, postType: $postType }) {
      content
      images
      neighborhood {
        placeId
        label
      }
      postType
      postedAt
      author {
        accountId
        avatar
        name
      }
    }
  }
`;

export const NEIGHBORS = gql`
  query GetNeighbors($placeId: String!) {
    users(query: { neighborhood: { placeId: $placeId } }) {
      accountId
      name
      avatar
      lastActive
      neighborhood {
        placeId
      }
    }
  }
`;

export const USER = gql`
  query GetUser($accountId: String!) {
    user(query: { accountId: $accountId }) {
      accountId
      name
      avatar
      lastActive
      neighborhood {
        placeId
        label
      }
    }
  }
`;

export const USER_POSTS = gql`
  query GetUserPosts($accountId: String!) {
    posts(query: { authorId: $accountId }) {
      authorId
      neighborhood {
        placeId
        label
      }
      content
      postType
      postedAt
      images
    }
  }
`;
