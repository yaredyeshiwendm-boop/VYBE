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
            type="button"
            aria-label="Comments"
          >
            💬
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



