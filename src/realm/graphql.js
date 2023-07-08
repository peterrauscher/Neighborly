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
  query GetPosts($placeId: String) {
    posts(query: { neighborhood: { placeId: $placeId } }) {
      author: user(accountId: authorId) {
        accountId
        avatar
        name
      }
      content
      images
      neighborhood {
        placeId
      }
      postType
      postedAt
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
