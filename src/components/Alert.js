const Alert = ({ type = "info", title = "Alert", message = "" }) => {
  return (
    <article className={`message is-${type}`}>
      <div className="message-header has-text-centered">
        <p>{title}</p>
      </div>
      <div className="message-body">
        <p>{message}</p>
      </div>
    </article>
  );
};

export default Alert;
