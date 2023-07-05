import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { POST, POSTS } from "../realm/graphql";
import NeighborhoodSelect from "../components/NeighborhoodSelect";
import Compose from "../components/Compose";
import { UserContext } from "../contexts/UserContext";
import axios from "axios";
import { useMutation, useQuery } from "@apollo/client";
import Loading from "components/Loading";
import DefaultErrorPage from "./DefaultErrorPage";
import Modal from "components/Modal";

const Feed = () => {
  const { loading, error, data } = useQuery(POSTS);

  if (loading) return <Loading />;
  if (error) return <DefaultErrorPage />;

  return (
    <div className="feed">
      <div className="columns">
        <div className="column is-3">
          <div className="box sidebar">
            <NeighborhoodSelect />
            <Link to="/feed">
              <p>All Posts</p>
            </Link>
            <Link to="/feed/lend">
              <p>Lend</p>
            </Link>
            <Link to="/feed/borrow">
              <p>Borrow</p>
            </Link>
            <Link to="/feed/trade">
              <p>Trade</p>
            </Link>
          </div>
          <div className="box sidebar">
            <p className="heading">FILTERS</p>
          </div>
        </div>
        <div className="column scrollable">
          <Compose />
          <div className="post-feed">
            {data?.posts &&
              data.posts.map((post) => (
                <div className="card post" key={post.id}>
                  <article className="media">
                    {post.images && (
                      <div className="media-left">
                        <figure className="image is-64x64">
                          <img src={post.images[0]} alt="Post" />
                        </figure>
                      </div>
                    )}
                    <div className="media-content">
                      <div className="content">
                        <p>
                          <strong>{post.authorId}</strong>
                          <br />
                          {post.content}
                        </p>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feed;
