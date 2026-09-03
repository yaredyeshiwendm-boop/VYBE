"use strict";

const state = {
  user: null,
  authenticated: false
};

const $ = (selector) => document.querySelector(selector);

const splashScreen = $("#splashScreen");
const authScreen = $("#authScreen");
const homeScreen = $("#homeScreen");

const loginView = $("#loginView");
const registerView = $("#registerView");

const loginForm = $("#loginForm");
const registerForm = $("#registerForm");

const loginError = $("#loginError");
const registerError = $("#registerError");

function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function showError(element, message) {
  element.textContent = message;
  show(element);
}

function clearError(element) {
  element.textContent = "";
  hide(element);
}

function setButtonLoading(button, loading, text) {
  const textElement = button.querySelector(".button-text");
  const loaderElement = button.querySelector(".button-loader");

  button.disabled = loading;

  if (loading) {
    hide(textElement);
    show(loaderElement);
  } else {
    show(textElement);
    hide(loaderElement);

    if (text) {
      textElement.textContent = text;
    }
  }
}

function showAuth() {
  hide(splashScreen);
  hide(homeScreen);
  show(authScreen);
}

function showHome() {
  hide(splashScreen);
  hide(authScreen);
  hide(profileScreen);

  show(homeScreen);

  updateHome();
  loadPosts();
}

function updateHome() {
  if (!state.user) return;

  const name =
    state.user.display_name ||
    state.user.username ||
    "VYBER";

  $("#welcomeName").textContent = name;

  $("#welcomeAvatar").textContent =
    name.charAt(0).toUpperCase();
}

function switchToRegister() {
  clearError(loginError);
  hide(loginView);
  show(registerView);

  $("#registerDisplayName").focus();
}

function switchToLogin() {
  clearError(registerError);
  hide(registerView);
  show(loginView);

  $("#loginIdentifier").focus();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Something went wrong"
    );
  }

  return data;
}

async function checkSession() {
  try {
    const data = await api("/api/auth/me");

    if (data.success && data.user) {
      state.user = data.user;
      state.authenticated = true;
      showHome();
      return true;
    }
  } catch {
    // Not authenticated.
  }

  state.user = null;
  state.authenticated = false;
  showAuth();

  return false;
}

async function handleLogin(event) {
  event.preventDefault();

  clearError(loginError);

  const button = $("#loginButton");

  const identifier =
    $("#loginIdentifier").value.trim();

  const password =
    $("#loginPassword").value;

  if (!identifier || !password) {
    showError(
      loginError,
      "Enter your username/email and password."
    );
    return;
  }

  setButtonLoading(button, true);

  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier,
        password
      })
    });

    state.user = data.user;
    state.authenticated = true;

    loginForm.reset();

    showHome();
  } catch (error) {
    showError(
      loginError,
      error.message || "Login failed."
    );
  } finally {
    setButtonLoading(button, false, "Log In");
  }
}

async function handleRegister(event) {
  event.preventDefault();

  clearError(registerError);

  const button = $("#registerButton");

  const displayName =
    $("#registerDisplayName").value.trim();

  const username =
    $("#registerUsername").value.trim().toLowerCase();

  const email =
    $("#registerEmail").value.trim().toLowerCase();

  const password =
    $("#registerPassword").value;

  if (!displayName) {
    showError(registerError, "Enter your display name.");
    return;
  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    showError(
      registerError,
      "Username must be 3–30 characters using letters, numbers, or _."
    );
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError(
      registerError,
      "Enter a valid email address."
    );
    return;
  }

  if (password.length < 8) {
    showError(
      registerError,
      "Password must be at least 8 characters."
    );
    return;
  }

  setButtonLoading(button, true);

  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName,
        username,
        email,
        password
      })
    });

    state.user = data.user;
    state.authenticated = true;

    registerForm.reset();

    showHome();
  } catch (error) {
    showError(
      registerError,
      error.message || "Registration failed."
    );
  } finally {
    setButtonLoading(
      button,
      false,
      "Create Account"
    );
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", {
      method: "POST"
    });
  } catch {
    // Continue local logout even if request fails.
  }

  state.user = null;
  state.authenticated = false;

  showAuth();
  switchToLogin();
}

/* --------------------------------
   EVENTS
-------------------------------- */

$("#showRegister").addEventListener(
  "click",
  switchToRegister
);

$("#showLogin").addEventListener(
  "click",
  switchToLogin
);

loginForm.addEventListener(
  "submit",
  handleLogin
);

registerForm.addEventListener(
  "submit",
  handleRegister
);

/* Password visibility */

document
  .querySelectorAll(".password-toggle")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(
        button.dataset.target
      );

      if (target.type === "password") {
        target.type = "text";
        button.textContent = "🙈";
      } else {
        target.type = "password";
        button.textContent = "👁";
      }
    });
  });

/* Navigation */

$("#createFirstPost").addEventListener(
  "click",
  () => {
    alert("Create Post is coming next.");
  }
);

/* --------------------------------
   STARTUP
-------------------------------- */

window.addEventListener("load", () => {
  setTimeout(() => {
    checkSession();
  }, 1900);
});

/* --------------------------------
   PROFILE SYSTEM
-------------------------------- */

const profileScreen = document.getElementById("profileScreen");
const editProfileModal = document.getElementById("editProfileModal");

async function loadProfile() {
  try {
    const data = await api("/api/profile/me");

    if (!data.success || !data.profile) {
      throw new Error("Could not load profile.");
    }

    state.user = {
      ...state.user,
      ...data.profile
    };

    renderProfile();
  } catch (error) {
    alert(error.message || "Could not load profile.");
  }
}

function renderProfile() {
  if (!state.user) return;

  const name =
    state.user.display_name ||
    state.user.username ||
    "VYBER";

  const username =
    state.user.username || "";

  const bio =
    state.user.bio || "";

  document.getElementById(
    "profileDisplayName"
  ).textContent = name;

  document.getElementById(
    "profileUsername"
  ).textContent = `@${username}`;

  document.getElementById(
    "profileBio"
  ).textContent = bio;

  document.getElementById(
    "profilePostsCount"
  ).textContent = Number(
    state.user.posts_count || 0
  );

  document.getElementById(
    "profileAvatar"
  ).textContent = name
    .charAt(0)
    .toUpperCase();
}

function showProfile() {
  hide(homeScreen);
  hide(authScreen);
  show(profileScreen);

  loadProfile();
}

function hideProfile() {
  hide(profileScreen);
  showHome();
}

function openEditProfile() {
  if (!state.user) return;

  document.getElementById(
    "editDisplayName"
  ).value = state.user.display_name || "";

  document.getElementById(
    "editUsername"
  ).value = state.user.username || "";

  document.getElementById(
    "editBio"
  ).value = state.user.bio || "";

  clearError(
    document.getElementById("editProfileError")
  );

  show(editProfileModal);
}

function closeEditProfile() {
  hide(editProfileModal);
}

async function saveProfile(event) {
  event.preventDefault();

  const errorElement =
    document.getElementById("editProfileError");

  const button =
    document.getElementById("saveProfileButton");

  clearError(errorElement);

  const displayName =
    document.getElementById(
      "editDisplayName"
    ).value.trim();

  const username =
    document.getElementById(
      "editUsername"
    ).value.trim().toLowerCase();

  const bio =
    document.getElementById(
      "editBio"
    ).value.trim();

  if (!displayName) {
    showError(
      errorElement,
      "Display name is required."
    );
    return;
  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    showError(
      errorElement,
      "Username must be 3–30 characters using letters, numbers, or _."
    );
    return;
  }

  if (bio.length > 160) {
    showError(
      errorElement,
      "Bio must be 160 characters or less."
    );
    return;
  }

  setButtonLoading(button, true);

  try {
    const data = await api(
      "/api/profile/me",
      {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          username,
          bio
        })
      }
    );

    state.user = {
      ...state.user,
      ...data.profile
    };

    renderProfile();
    updateHome();

    closeEditProfile();
  } catch (error) {
    showError(
      errorElement,
      error.message || "Could not save profile."
    );
  } finally {
    setButtonLoading(
      button,
      false,
      "Save Changes"
    );
  }
}

/* Profile navigation */

document
  .querySelector('[data-nav="profile"]')
  .addEventListener("click", showProfile);

document
  .getElementById("profileBack")
  .addEventListener("click", hideProfile);

document
  .getElementById("editProfileButton")
  .addEventListener("click", openEditProfile);

document
  .getElementById("closeEditProfile")
  .addEventListener("click", closeEditProfile);

document
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeEditProfile);

document
  .getElementById("editProfileForm")
  .addEventListener("submit", saveProfile);

document
  .getElementById("logoutButton")
  .addEventListener("click", logout);

/* --------------------------------
   POSTS SYSTEM
-------------------------------- */

const createPostModal =
  document.getElementById("createPostModal");

const postsFeed =
  document.getElementById("postsFeed");

async function loadPosts() {
  try {
    const data = await api("/api/posts");

    if (!data.success) {
      throw new Error(
        data.error || "Could not load posts."
      );
    }

    renderPosts(data.posts || []);
  } catch (error) {
    console.error(error);

    postsFeed.innerHTML = `
      <div class="profile-empty">
        <div>⚠</div>
        <h2>Couldn't load posts</h2>
        <p>${escapeHtml(
          error.message || "Please try again."
        )}</p>
      </div>
    `;
  }
}

function renderPosts(posts) {
  if (!posts.length) {
    postsFeed.innerHTML = `
      <div class="profile-empty">
        <div>✦</div>
        <h2>No posts yet</h2>
        <p>Be the first person to VYBE.</p>
      </div>
    `;
    return;
  }

  postsFeed.innerHTML = posts.map(post => {
    const name =
      post.display_name ||
      post.username ||
      "VYBER";

    const initial =
      name.charAt(0).toUpperCase();

    const date =
      new Date(post.created_at)
        .toLocaleString();

    const isMine =
      state.user &&
      state.user.id === post.user_id;

    const reactionCount =
      Number(post.reaction_count || 0);

    const isLiked =
      post.viewer_reaction === "like";

    return `
      <article
        class="post-card"
        data-post-id="${escapeHtml(post.id)}"
      >

        <div class="post-author">

          <div class="post-avatar">
            ${escapeHtml(initial)}
          </div>

          <div class="post-author-info">
            <strong>
              ${escapeHtml(name)}
              ${post.is_verified ? " ✓" : ""}
            </strong>

            <span>
              @${escapeHtml(post.username)}
              · ${escapeHtml(date)}
            </span>
          </div>

          ${
            isMine
              ? `
                <button
                  class="post-menu"
                  data-delete-post="${escapeHtml(post.id)}"
                  type="button"
                  aria-label="Post options"
                >
                  ⋯
                </button>
              `
              : ""
          }

        </div>

        <div class="post-content">
          ${escapeHtml(post.content)}
        </div>

        <div class="post-actions">

          <button
            class="reaction-button ${isLiked ? "reacted" : ""}"
            data-reaction-post="${escapeHtml(post.id)}"
            data-reaction-active="${isLiked ? "true" : "false"}"
            type="button"
            aria-label="${isLiked ? "Unlike post" : "Like post"}"
            aria-pressed="${isLiked ? "true" : "false"}"
          >
            <span class="reaction-icon">
              ${isLiked ? "♥" : "♡"}
            </span>

            <span
              class="reaction-count"
              data-reaction-count="${escapeHtml(post.id)}"
            >
              ${reactionCount}
            </span>
          </button>

          <button
            class="comments-button"
            type="button"
            aria-label="Comments"
            data-comment-post="${escapeHtml(post.id)}"
          >
            💬
            <span class="comment-count" data-comment-count="${escapeHtml(post.id)}">0</span>
          </button>

          <button
            type="button"
            aria-label="Share"
          >
            ↗
          </button>

        </div>

      </article>
    `;
  }).join("");

  postsFeed
    .querySelectorAll("[data-delete-post]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deletePost(button.dataset.deletePost)
      );
    });

  postsFeed
    .querySelectorAll("[data-reaction-post]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => toggleReaction(button.dataset.reactionPost, button)
      );
    });

  postsFeed
    .querySelectorAll("[data-comment-post]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => openComments(button.dataset.commentPost)
      );
    });

  postsFeed
    .querySelectorAll("[data-comment-post]")
    .forEach(button => {
      loadCommentCount(
        button.dataset.commentPost,
        button
      );
    });
}



let activeCommentsPostId = null;

const commentsModal = document.getElementById("commentsModal");
const commentsList = document.getElementById("commentsList");
const commentForm = document.getElementById("commentForm");
const commentContent = document.getElementById("commentContent");
const submitComment = document.getElementById("submitComment");
const commentError = document.getElementById("commentError");

function setCommentError(message = "") {
  if (!commentError) return;

  commentError.textContent = message;

  commentError.classList.toggle(
    "hidden",
    !message
  );
}

function formatCommentDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function renderComments(comments) {
  if (!commentsList) return;

  if (!comments.length) {
    commentsList.innerHTML = `
      <div class="comments-empty">
        <div class="comments-empty-icon">💬</div>
        <strong>No comments yet</strong>
        <p>Be the first to VYBE.</p>
      </div>
    `;
    return;
  }

  commentsList.innerHTML = comments.map(comment => {
    const name =
      comment.display_name ||
      comment.username ||
      "VYBER";

    const initial =
      name.charAt(0).toUpperCase();

    const isMine =
      state.user &&
      state.user.id === comment.user_id;

    return `
      <article
        class="comment-item"
        data-comment-id="${escapeHtml(comment.id)}"
      >
        <div class="comment-avatar">
          ${escapeHtml(initial)}
        </div>

        <div class="comment-body">
          <div class="comment-meta">
            <strong>
              ${escapeHtml(name)}
              ${comment.is_verified ? " ✓" : ""}
            </strong>

            <span>
              @${escapeHtml(comment.username)}
              · ${escapeHtml(
                formatCommentDate(comment.created_at)
              )}
            </span>
          </div>

          <p class="comment-text">
            ${escapeHtml(comment.content)}
          </p>

          ${
            isMine
              ? `
                <button
                  class="comment-delete"
                  type="button"
                  data-delete-comment="${escapeHtml(comment.id)}"
                >
                  Delete
                </button>
              `
              : ""
          }
        </div>
      </article>
    `;
  }).join("");

  commentsList
    .querySelectorAll("[data-delete-comment]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deleteComment(
          activeCommentsPostId,
          button.dataset.deleteComment,
          button
        )
      );
    });
}

async function loadComments(postId) {
  if (!commentsList) return;

  commentsList.innerHTML = `
    <div class="comments-loading">
      Loading comments…
    </div>
  `;

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/comments`
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not load comments."
      );
    }

    renderComments(data.comments || []);
    updateCommentCount(
      postId,
      (data.comments || []).length
    );

  } catch (error) {
    console.error("Load comments error:", error);

    commentsList.innerHTML = `
      <div class="comments-error">
        <strong>Couldn't load comments</strong>
        <p>${escapeHtml(
          error.message || "Please try again."
        )}</p>

        <button
          type="button"
          class="secondary-button"
          data-retry-comments
        >
          Try again
        </button>
      </div>
    `;

    const retry =
      commentsList.querySelector(
        "[data-retry-comments]"
      );

    if (retry) {
      retry.addEventListener(
        "click",
        () => loadComments(postId)
      );
    }
  }
}

function updateCommentCount(postId, count) {
  const button =
    postsFeed?.querySelector(
      `[data-comment-post="${CSS.escape(postId)}"]`
    );

  if (!button) return;

  const countElement =
    button.querySelector(
      `[data-comment-count="${CSS.escape(postId)}"]`
    );

  if (countElement) {
    countElement.textContent = String(count);
  }
}

async function loadCommentCount(postId, button) {
  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/comments`
    );

    if (!data.success) return;

    const countElement =
      button.querySelector(".comment-count");

    if (countElement) {
      countElement.textContent =
        String((data.comments || []).length);
    }
  } catch (error) {
    console.error(
      "Comment count error:",
      error
    );
  }
}

function openComments(postId) {
  if (!commentsModal) return;

  activeCommentsPostId = postId;

  setCommentError("");

  commentsModal.classList.remove("hidden");
  commentsModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "comments-open"
  );

  if (commentContent) {
    commentContent.value = "";
  }

  loadComments(postId);

  setTimeout(() => {
    commentContent?.focus();
  }, 50);
}

function closeComments() {
  if (!commentsModal) return;

  commentsModal.classList.add("hidden");
  commentsModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "comments-open"
  );

  activeCommentsPostId = null;
  setCommentError("");
}

document
  .querySelectorAll("[data-close-comments]")
  .forEach(element => {
    element.addEventListener(
      "click",
      closeComments
    );
  });

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      commentsModal &&
      !commentsModal.classList.contains("hidden")
    ) {
      closeComments();
    }
  }
);

async function submitCommentRequest() {
  if (!activeCommentsPostId) return;

  if (
    !state.authenticated ||
    !state.user
  ) {
    setCommentError(
      "Please log in to comment."
    );
    return;
  }

  const content =
    String(commentContent?.value || "")
      .trim();

  if (!content) {
    setCommentError(
      "Comment cannot be empty."
    );
    commentContent?.focus();
    return;
  }

  if (content.length > 1000) {
    setCommentError(
      "Comment cannot exceed 1000 characters."
    );
    return;
  }

  if (submitComment?.disabled) return;

  setCommentError("");

  submitComment.disabled = true;
  submitComment.textContent = "Posting…";

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(activeCommentsPostId)}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          content
        })
      }
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not post comment."
      );
    }

    commentContent.value = "";

    await loadComments(
      activeCommentsPostId
    );

  } catch (error) {
    console.error(
      "Create comment error:",
      error
    );

    setCommentError(
      error.message ||
      "Could not post comment."
    );
  } finally {
    submitComment.disabled = false;
    submitComment.textContent = "Post";
  }
}

commentForm?.addEventListener(
  "submit",
  event => {
    event.preventDefault();
    submitCommentRequest();
  }
);

async function deleteComment(
  postId,
  commentId,
  button
) {
  if (!postId || !commentId) return;

  if (
    !state.authenticated ||
    !state.user
  ) {
    setCommentError(
      "Please log in to delete comments."
    );
    return;
  }

  if (button.disabled) return;

  const confirmed =
    window.confirm(
      "Delete this comment?"
    );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting…";

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "DELETE"
      }
    );

    if (!data.success) {
      throw new Error(
        data.error ||
        "Could not delete comment."
      );
    }

    await loadComments(postId);

  } catch (error) {
    console.error(
      "Delete comment error:",
      error
    );

    setCommentError(
      error.message ||
      "Could not delete comment."
    );

    button.disabled = false;
    button.textContent = "Delete";
  }
}


async function toggleReaction(postId, button) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to react to posts.");
    return;
  }

  if (button.disabled) {
    return;
  }

  const isActive =
    button.dataset.reactionActive === "true";

  button.disabled = true;
  button.classList.add("reaction-loading");

  try {
    let data;

    if (isActive) {
      data = await api(
        `/api/posts/${encodeURIComponent(postId)}/reaction`,
        {
          method: "DELETE"
        }
      );
    } else {
      data = await api(
        `/api/posts/${encodeURIComponent(postId)}/reaction`,
        {
          method: "PUT",
          body: JSON.stringify({
            reaction: "like"
          })
        }
      );
    }

    if (!data.success) {
      throw new Error(
        data.error || "Could not update reaction."
      );
    }

    const nowActive = !isActive;

    button.dataset.reactionActive =
      nowActive ? "true" : "false";

    button.classList.toggle(
      "reacted",
      nowActive
    );

    button.setAttribute(
      "aria-pressed",
      nowActive ? "true" : "false"
    );

    button.setAttribute(
      "aria-label",
      nowActive ? "Unlike post" : "Like post"
    );

    const icon =
      button.querySelector(".reaction-icon");

    if (icon) {
      icon.textContent =
        nowActive ? "♥" : "♡";
    }

    const count =
      button.querySelector(".reaction-count");

    if (count) {
      count.textContent =
        String(data.reaction_count ?? 0);
    }

  } catch (error) {
    console.error("Reaction error:", error);

    alert(
      error.message ||
      "Could not update reaction."
    );

  } finally {
    button.disabled = false;
    button.classList.remove("reaction-loading");
  }
}


function openCreatePost() {
  clearError(
    document.getElementById("createPostError")
  );

  document.getElementById(
    "postContent"
  ).value = "";

  document.getElementById(
    "postCharacterCount"
  ).textContent = "0";

  show(createPostModal);

  setTimeout(() => {
    document.getElementById(
      "postContent"
    ).focus();
  }, 100);
}

function closeCreatePost() {
  hide(createPostModal);
}

async function createPost(event) {
  event.preventDefault();

  const content =
    document.getElementById(
      "postContent"
    ).value.trim();

  const errorElement =
    document.getElementById(
      "createPostError"
    );

  const button =
    document.getElementById(
      "publishPostButton"
    );

  clearError(errorElement);

  if (!content) {
    showError(
      errorElement,
      "Write something before posting."
    );
    return;
  }

  setButtonLoading(button, true);

  try {
    const data = await api(
      "/api/posts",
      {
        method: "POST",
        body: JSON.stringify({ content })
      }
    );

    closeCreatePost();

    await loadPosts();

    await loadProfile();

  } catch (error) {
    showError(
      errorElement,
      error.message ||
      "Could not create post."
    );
  } finally {
    setButtonLoading(
      button,
      false,
      "Post"
    );
  }
}

async function deletePost(postId) {
  const confirmed =
    confirm("Delete this post?");

  if (!confirmed) return;

  try {
    await api(
      `/api/posts/${encodeURIComponent(postId)}`,
      {
        method: "DELETE"
      }
    );

    await loadPosts();
    await loadProfile();

  } catch (error) {
    alert(
      error.message ||
      "Could not delete post."
    );
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* Character counter */

document
  .getElementById("postContent")
  .addEventListener("input", event => {
    document.getElementById(
      "postCharacterCount"
    ).textContent =
      event.target.value.length;
  });


/* Create post events */

document
  .getElementById("createPostForm")
  .addEventListener(
    "submit",
    createPost
  );

document
  .getElementById("closeCreatePost")
  .addEventListener(
    "click",
    closeCreatePost
  );


/* Existing create buttons */

const createFirstPost =
  document.getElementById("createFirstPost");

if (createFirstPost) {
  createFirstPost.addEventListener(
    "click",
    openCreatePost
  );
}


/*
 * Top create button
 * replaces future alert behavior
 */
document
  .querySelectorAll('[data-nav="create"]')
  .forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        openCreatePost();
      }
    );
  });



