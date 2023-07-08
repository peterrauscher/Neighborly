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

export const POSTS = gql`
  query GetPosts($placeId: String) {
    posts(query: { neighborhood: { placeId: $placeId } }) {
      _id
      authorId
      content
      images
      neighborhood {
        label
        placeId
      }
      postType
      postedAt
    }
  }
`;
