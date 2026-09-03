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

  if (typeof searchScreen !== "undefined" && searchScreen) {
    hide(searchScreen);
  }

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
      loadActivityNotifications();
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
    loadActivityNotifications();

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
    loadActivityNotifications();

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
    "profileFollowersCount"
  ).textContent = Number(
    state.user.followers_count || 0
  );

  document.getElementById(
    "profileFollowingCount"
  ).textContent = Number(
    state.user.following_count || 0
  );

  document.getElementById(
    "profileAvatar"
  ).textContent = name
    .charAt(0)
    .toUpperCase();
}

function showProfile() {
  hide(splashScreen);
  hide(homeScreen);
  hide(authScreen);

  if (typeof searchScreen !== "undefined" && searchScreen) {
    hide(searchScreen);
  }

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
   PUBLIC PROFILE + FOLLOW
-------------------------------- */

let activePublicProfile = null;

async function showPublicProfile(username) {
  username = String(username || "").trim().toLowerCase();

  if (!username) return;

  try {
    const data = await api(
      `/api/profile/${encodeURIComponent(username)}`
    );

    if (!data.success || !data.profile) {
      throw new Error("Profile not found.");
    }

    activePublicProfile = data.profile;

    hide(homeScreen);
    hide(authScreen);
    hide(profileScreen);

    let screen = document.getElementById("publicProfileScreen");

    if (!screen) {
      screen = document.createElement("section");
      screen.id = "publicProfileScreen";
      screen.className = "screen public-profile-screen";

      screen.innerHTML = `
        <header class="profile-topbar">
          <button id="publicProfileBack" type="button">←</button>
          <strong>Profile</strong>
          <span></span>
        </header>

        <main class="profile-content">
          <div class="profile-header">
            <div class="profile-avatar" id="publicProfileAvatar">V</div>

            <div class="profile-main">
              <h1 id="publicProfileDisplayName">VYBER</h1>
              <p id="publicProfileUsername">@username</p>
              <p id="publicProfileBio"></p>
            </div>
          </div>

          <div class="profile-stats">
            <div>
              <strong id="publicProfilePostsCount">0</strong>
              <span>Posts</span>
            </div>

            <div>
              <strong id="publicProfileFollowersCount">0</strong>
              <span>Followers</span>
            </div>

            <div>
              <strong id="publicProfileFollowingCount">0</strong>
              <span>Following</span>
            </div>
          </div>

          <button
            id="publicProfileFollowButton"
            class="profile-edit-button"
            type="button"
          >
            Follow
          </button>

          <div
            id="publicProfilePosts"
            class="public-profile-posts"
          ></div>

          <div id="publicProfilePostsEmpty" class="profile-empty">
            <div>✦</div>
            <h2>No posts yet</h2>
            <p>This VYBER hasn't posted anything yet.</p>
          </div>
        </main>
      `;

      document.body.appendChild(screen);

      document
        .getElementById("publicProfileBack")
        .addEventListener("click", () => {
          screen.remove();
          showHome();
        });

      document
        .getElementById("publicProfileFollowButton")
        .addEventListener("click", togglePublicProfileFollow);
    }

    renderPublicProfile(activePublicProfile);
    show(screen);

    await loadPublicProfilePosts(activePublicProfile.username);

  } catch (error) {
    alert(error.message || "Could not load profile.");
  }
}

async function loadPublicProfilePosts(username) {
  const empty = document.getElementById("publicProfilePostsEmpty");

  if (!empty) return;

  try {
    const data = await api(
      `/api/posts/user/${encodeURIComponent(username)}`
    );

    const posts = data.posts || [];

    if (posts.length === 0) {
      empty.hidden = false;
      empty.innerHTML = `
        <div>✦</div>
        <h2>No posts yet</h2>
        <p>This VYBER hasn't posted anything yet.</p>
      `;
      return;
    }

    empty.hidden = true;

    const container =
      document.getElementById("publicProfilePosts");

    if (!container) {
      const postsContainer = document.createElement("div");
      postsContainer.id = "publicProfilePosts";
      postsContainer.className = "public-profile-posts";

      empty.parentNode.insertBefore(
        postsContainer,
        empty
      );
    }

    renderPublicProfilePosts(posts);

  } catch (error) {
    console.error("Public profile posts error:", error);

    empty.hidden = false;
    empty.innerHTML = `
      <div>⚠</div>
      <h2>Couldn't load posts</h2>
      <p>Please try again.</p>
    `;
  }
}

function renderPublicProfilePosts(posts) {
  const container =
    document.getElementById("publicProfilePosts");

  if (!container) return;

  container.innerHTML = posts.map(post => {
    const name =
      post.display_name ||
      post.username ||
      "VYBER";

    const initial =
      name.charAt(0).toUpperCase();

    const date =
      new Date(post.created_at).toLocaleString();

    const reactionCount =
      Number(post.reaction_count || 0);

    const viewerReaction =
      post.viewer_reaction || "";

    const repostCount =
      Number(post.repost_count || 0);

    const saveCount =
      Number(post.save_count || 0);

    return `
      <article
        class="post-card public-profile-post"
        data-post-id="${escapeHtml(post.id)}"
        data-viewer-reaction="${escapeHtml(viewerReaction)}"
        data-viewer-reposted="${post.viewer_reposted ? "true" : "false"}"
        data-repost-count="${repostCount}"
        data-viewer-saved="${post.viewer_saved ? "true" : "false"}"
        data-save-count="${saveCount}"
      >

        <div class="post-author">

          <div class="post-avatar">
            ${escapeHtml(initial)}
          </div>

          <div class="post-author-info">
            <strong class="post-author-name">
              ${escapeHtml(name)}
              ${post.is_verified ? " ✓" : ""}
            </strong>

            <span
              class="post-author-username"
              data-username="${escapeHtml(post.username)}"
            >
              @${escapeHtml(post.username)}
              · ${escapeHtml(date)}
            </span>
          </div>

        </div>

        <div class="post-content">
          ${escapeHtml(post.content)}
        </div>

        <div
          class="post-comments-trigger"
          data-comment-post="${escapeHtml(post.id)}"
          role="button"
          tabindex="0"
          aria-label="View comments"
        >
          <span class="comments-trigger-icon">💬</span>
          <span class="comments-trigger-text">
            View comments
          </span>
          <span
            class="comment-count"
            data-comment-count="${escapeHtml(post.id)}"
          >
            0
          </span>
        </div>

        <div
          class="reaction-summary"
          data-reaction-summary="${escapeHtml(post.id)}"
          aria-label="Post reactions"
        >
          <span class="reaction-summary-icon">
            ${viewerReaction
              ? getReactionIcon(viewerReaction)
              : "♡"}
          </span>

          <span class="reaction-summary-count">
            ${reactionCount}
          </span>
        </div>

        <div class="post-actions">

          <button
            type="button"
            class="post-action-button"
            data-repost-post="${escapeHtml(post.id)}"
          >
            🔄 <span data-repost-label>Repost</span>
            <span data-repost-count>
              ${repostCount}
            </span>
          </button>

          <button
            type="button"
            class="post-action-button"
            data-share-post="${escapeHtml(post.id)}"
          >
            ↗ Share
          </button>

        </div>

        <div
          class="post-action-menu hidden"
          data-post-menu="${escapeHtml(post.id)}"
        >

          <div class="menu-quick-reactions">

            ${QUICK_REACTIONS.map(reaction => `
              <button
                type="button"
                class="menu-reaction"
                data-menu-reaction="${escapeHtml(reaction.type)}"
                aria-label="${escapeHtml(reaction.label)}"
              >
                ${reaction.icon}
              </button>
            `).join("")}

            <button
              type="button"
              class="menu-more-reactions"
              data-menu-more-reactions
              aria-expanded="false"
            >
              ↓
            </button>

          </div>

          <div
            class="menu-more-reactions-panel hidden"
            data-more-reactions="${escapeHtml(post.id)}"
          >
            ${ALL_REACTIONS.map(reaction => `
              <button
                type="button"
                class="menu-reaction"
                data-menu-reaction="${escapeHtml(reaction.type)}"
                aria-label="${escapeHtml(reaction.label)}"
              >
                ${reaction.icon}
              </button>
            `).join("")}
          </div>

          <button
            type="button"
            class="post-menu-item"
            data-menu-save="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">🔖</span>
            <span>Save</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-repost="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">🔄</span>
            <span>Repost</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-share="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">↗</span>
            <span>Share</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-forward="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">➤</span>
            <span>Forward</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-report="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">⚑</span>
            <span>Report</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-copy="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">⧉</span>
            <span>Copy</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-copy-link="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">🔗</span>
            <span>Copy link</span>
          </button>

        </div>

      </article>
    `;
  }).join("");

  setupPostInteractions();

  posts.forEach(post => {
    loadCommentCount(post.id);
  });
}

function renderPublicProfile(profile) {
  const name =
    profile.display_name ||
    profile.username ||
    "VYBER";

  document.getElementById("publicProfileDisplayName").textContent =
    name;

  document.getElementById("publicProfileUsername").textContent =
    `@${profile.username}`;

  document.getElementById("publicProfileBio").textContent =
    profile.bio || "";

  document.getElementById("publicProfileAvatar").textContent =
    name.charAt(0).toUpperCase();

  document.getElementById("publicProfilePostsCount").textContent =
    Number(profile.posts_count || 0);

  document.getElementById("publicProfileFollowersCount").textContent =
    Number(profile.followers_count || 0);

  document.getElementById("publicProfileFollowingCount").textContent =
    Number(profile.following_count || 0);

  const button =
    document.getElementById("publicProfileFollowButton");

  const isMe =
    state.user &&
    state.user.id === profile.id;

  button.hidden = Boolean(isMe);

  if (!isMe) {
    button.textContent =
      profile.viewer_following ? "Following" : "Follow";
  }
}

async function togglePublicProfileFollow() {
  if (!activePublicProfile) return;

  const button =
    document.getElementById("publicProfileFollowButton");

  const username = activePublicProfile.username;
  const following = Boolean(activePublicProfile.viewer_following);

  button.disabled = true;

  try {
    const data = await api(
      `/api/profile/${encodeURIComponent(username)}/follow`,
      {
        method: following ? "DELETE" : "PUT"
      }
    );

    activePublicProfile = {
      ...activePublicProfile,
      viewer_following: data.following,
      followers_count: data.followers_count
    };

    renderPublicProfile(activePublicProfile);
  } catch (error) {
    alert(error.message || "Could not update follow.");
  } finally {
    button.disabled = false;
  }
}

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

const reactionCounts =
  post.reaction_counts || {};

const viewerReaction =
  post.viewer_reaction || null;

    return `
      <article
        class="post-card"
        data-post-id="${escapeHtml(post.id)}"
        data-viewer-reaction="${escapeHtml(viewerReaction || "")}"
        data-viewer-reposted="${post.viewer_reposted ? "true" : "false"}"
        data-repost-count="${Number(post.repost_count) || 0}"
        data-viewer-saved="${post.viewer_saved ? "true" : "false"}"
        data-save-count="${Number(post.save_count) || 0}"
      >

        <div class="post-author">

          <div class="post-avatar">
            ${escapeHtml(initial)}
          </div>

          <div class="post-author-info">
            <strong class="post-author-name">
              ${escapeHtml(name)}
              ${post.is_verified ? " ✓" : ""}
            </strong>

            <span
              class="post-author-username"
              data-username="${escapeHtml(post.username)}"
            >
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
   
        <div
          class="post-comments-trigger"
          data-comment-post="${escapeHtml(post.id)}"
          role="button"
          tabindex="0"
          aria-label="View comments"
        >
          <span class="comments-trigger-icon">💬</span>
          <span class="comments-trigger-text">
            View comments
          </span>
          <span
            class="comment-count"
            data-comment-count="${escapeHtml(post.id)}"
          >
            0
          </span>
        </div>

        <div class="post-actions">

          <div
            class="reaction-summary"
            data-reaction-summary="${escapeHtml(post.id)}"
            aria-label="Post reactions"
          >
            ${
              Object.entries(reactionCounts)
                .filter(([, count]) => Number(count) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .map(([type, count]) => `
                  <span
                    class="reaction-summary-item ${
                      viewerReaction === type
                        ? "viewer-reacted"
                        : ""
                    }"
                    aria-label="${escapeHtml(type)} ${Number(count)}"
                  >
                    <span class="reaction-summary-icon">
                      ${getReactionIcon(type)}
                    </span>
                    <span class="reaction-summary-count">
                      ${Number(count)}
                    </span>
                  </span>
                `)
                .join("")
            }
          </div>

          <div class="post-action-right">

            <button
              class="repost-button"
              type="button"
              aria-label="Repost"
              aria-pressed="${
                post.viewer_reposted ? "true" : "false"
              }"
              data-repost-post="${escapeHtml(post.id)}"
            >
              <span class="action-icon">🔄</span>
              <span class="action-label">
                Repost${
                  Number(post.repost_count) > 0
                    ? ` ${Number(post.repost_count)}`
                    : ""
                }
              </span>
            </button>

            <button
              class="share-button"
              type="button"
              aria-label="Share post"
              data-share-post="${escapeHtml(post.id)}"
            >
              <span class="action-icon">↗</span>
              <span class="action-label">Share</span>
            </button>

          </div>

          <div
            class="post-action-menu hidden"
            data-action-menu="${escapeHtml(post.id)}"
            role="menu"
            aria-label="Post actions"
          >

            <div class="menu-quick-reactions">

              ${
                QUICK_REACTIONS.map(reaction => `
                  <button
                    type="button"
                    class="menu-reaction-button"
                    data-menu-reaction="${escapeHtml(reaction.type)}"
                    aria-label="${escapeHtml(reaction.label)}"
                    aria-pressed="false"
                    title="${escapeHtml(reaction.label)}"
                  >
                    ${reaction.icon}
                  </button>
                `).join("")
              }

              <button
                type="button"
                class="menu-more-reactions"
                data-menu-more-reactions
                aria-expanded="false"
                aria-label="More reactions"
                title="More reactions"
              >
                +
              </button>

            </div>

            <div
              class="menu-more-reactions-panel hidden"
              data-more-reactions="${escapeHtml(post.id)}"
            >
              ${
                ALL_REACTIONS.map(reaction => `
                  <button
                    type="button"
                    class="menu-reaction-button menu-reaction-full"
                    data-menu-reaction="${escapeHtml(reaction.type)}"
                    aria-label="${escapeHtml(reaction.label)}"
                    aria-pressed="false"
                    title="${escapeHtml(reaction.label)}"
                  >
                    <span>${reaction.icon}</span>
                    <small>${escapeHtml(reaction.label)}</small>
                  </button>
                `).join("")
              }
            </div>

            <div class="post-menu-divider"></div>

            <div class="post-menu-list">

              <button
                type="button"
                class="post-menu-item"
                data-menu-save="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">🔖</span>
                <span class="menu-item-text">
                  ${post.viewer_saved ? "Saved" : "Save"}
                </span>
              </button>

              <button
                type="button"
                class="post-menu-item"
                data-menu-repost="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">🔄</span>
                <span class="menu-item-text">Repost</span>
              </button>

              <button
                type="button"
                class="post-menu-item"
                data-menu-share="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">↗</span>
                <span class="menu-item-text">Share</span>
              </button>

              <button
                type="button"
                class="post-menu-item"
                data-menu-copy="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">📋</span>
                <span class="menu-item-text">Copy</span>
              </button>

              <button
                type="button"
                class="post-menu-item"
                data-menu-copy-link="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">🔗</span>
                <span class="menu-item-text">Copy link</span>
              </button>

            </div>
          </div>

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

  setupPostInteractions();
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



function getReactionIcon(type) {
  const icons = {
    like: "❤️",
    love: "🥰",
    laugh: "😂",
    wow: "😮",
    sad: "😢",
    angry: "😡"
  };

  return icons[type] || "❤️";
}


const QUICK_REACTIONS = [
  { type: "like",  icon: "❤️", label: "Like" },
  { type: "laugh", icon: "😂", label: "Laugh" },
  { type: "laugh", icon: "😁", label: "Grin" },
  { type: "love",  icon: "😍", label: "Love" },
  { type: "sad",   icon: "😭", label: "Sad" }
];

const ALL_REACTIONS = [
  { type: "like",  icon: "❤️", label: "Like" },
  { type: "love",  icon: "🥰", label: "Love" },
  { type: "laugh", icon: "😂", label: "Laugh" },
  { type: "wow",   icon: "😮", label: "Wow" },
  { type: "sad",   icon: "😢", label: "Sad" },
  { type: "angry", icon: "😡", label: "Angry" }
];

const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DISTANCE = 28;

let activePostActionMenu = null;
let tapTimer = null;
let lastTap = {
  postId: null,
  time: 0,
  x: 0,
  y: 0
};


function getPostCard(postId) {
  return document.querySelector(
    `.post-card[data-post-id="${CSS.escape(postId)}"]`
  );
}


function closeAllPostActionMenus() {
  document
    .querySelectorAll(".post-action-menu.menu-visible")
    .forEach(menu => {
      menu.classList.remove("menu-visible");
      menu.classList.add("hidden");
    });

  activePostActionMenu = null;
}


function closePostActionMenu(postId) {
  const card = getPostCard(postId);

  if (!card) return;

  const menu = card.querySelector(
    `[data-action-menu="${CSS.escape(postId)}"]`
  );

  if (!menu) return;

  menu.classList.remove("menu-visible");
  menu.classList.add("hidden");

  if (activePostActionMenu === postId) {
    activePostActionMenu = null;
  }
}


function openPostActionMenu(postId) {
  closeAllPostActionMenus();

  const card = getPostCard(postId);
  if (!card) return;

  const menu = card.querySelector(
    `[data-action-menu="${CSS.escape(postId)}"]`
  );

  if (!menu) return;

  menu.classList.remove("hidden");

  requestAnimationFrame(() => {
    menu.classList.add("menu-visible");
  });

  activePostActionMenu = postId;
}


function updateReactionUI(
  postId,
  reactionCounts = {},
  viewerReaction = null
) {
  const card = getPostCard(postId);

  if (!card) return;

  const summary = card.querySelector(
    "[data-reaction-summary]"
  );

  if (summary) {
    const entries = Object.entries(reactionCounts)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 4);

    summary.innerHTML = entries.map(
      ([type, count]) => `
        <span
          class="reaction-summary-item ${
            viewerReaction === type ? "viewer-reacted" : ""
          }"
          aria-label="${escapeHtml(type)} ${Number(count)}"
        >
          <span class="reaction-summary-icon">
            ${getReactionIcon(type)}
          </span>
          <span class="reaction-summary-count">
            ${Number(count)}
          </span>
        </span>
      `
    ).join("");
  }

  card.dataset.viewerReaction =
    viewerReaction || "";

  card
    .querySelectorAll("[data-menu-reaction]")
    .forEach(button => {
      const reaction =
        button.dataset.menuReaction;

      button.classList.toggle(
        "reaction-selected",
        reaction === viewerReaction
      );

      button.setAttribute(
        "aria-pressed",
        reaction === viewerReaction
          ? "true"
          : "false"
      );
    });
}


async function setReaction(
  postId,
  reactionType
) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to react to posts.");
    return false;
  }

  const card = getPostCard(postId);

  if (!card) return false;

  const buttons = card.querySelectorAll(
    "[data-menu-reaction]"
  );

  buttons.forEach(button => {
    button.disabled = true;
  });

  try {
    const currentReaction =
      card.dataset.viewerReaction || "";

    let data;

    if (currentReaction === reactionType) {
      data = await api(
        `/api/posts/${encodeURIComponent(postId)}/reaction`,
        {
          method: "DELETE"
        }
      );

      updateReactionUI(
        postId,
        data.reaction_counts || {},
        null
      );
    } else {
      data = await api(
        `/api/posts/${encodeURIComponent(postId)}/reaction`,
        {
          method: "PUT",
          body: JSON.stringify({
            reaction: reactionType
          })
        }
      );

      updateReactionUI(
        postId,
        data.reaction_counts || {},
        reactionType
      );
    }

    if (!data.success) {
      throw new Error(
        data.error || "Could not update reaction."
      );
    }

    closePostActionMenu(postId);

    return true;

  } catch (error) {
    console.error("Reaction error:", error);

    alert(
      error.message ||
      "Could not update reaction."
    );

    return false;

  } finally {
    buttons.forEach(button => {
      button.disabled = false;
    });
  }
}


async function toggleRepost(postId) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to repost posts.");
    return;
  }

  const card = getPostCard(postId);

  if (!card) return;

  const button = card.querySelector(
    `[data-repost-post="${CSS.escape(postId)}"]`
  );

  const alreadyReposted =
    card.dataset.viewerReposted === "true";

  if (button) button.disabled = true;

  try {
    const method = alreadyReposted
      ? "DELETE"
      : "PUT";

    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/repost`,
      { method }
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not update repost."
      );
    }

    card.dataset.viewerReposted =
      data.reposted ? "true" : "false";

    const count =
      Number(data.repost_count) || 0;

    card.dataset.repostCount =
      String(count);

    if (button) {
      button.classList.toggle(
        "action-active",
        data.reposted
      );

      button.setAttribute(
        "aria-pressed",
        data.reposted ? "true" : "false"
      );

      button.innerHTML = `
        <span class="action-icon">🔄</span>
        <span class="action-label">
          Repost${count > 0 ? ` ${count}` : ""}
        </span>
      `;
    }

    closePostActionMenu(postId);

  } catch (error) {
    console.error("Repost error:", error);

    alert(
      error.message ||
      "Could not repost post."
    );

  } finally {
    if (button) button.disabled = false;
  }
}


async function toggleSave(postId) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to save posts.");
    return;
  }

  const card = getPostCard(postId);

  if (!card) return;

  const alreadySaved =
    card.dataset.viewerSaved === "true";

  const menuSave =
    card.querySelector(
      `[data-menu-save="${CSS.escape(postId)}"]`
    );

  if (menuSave) menuSave.disabled = true;

  try {
    const method = alreadySaved
      ? "DELETE"
      : "PUT";

    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/save`,
      { method }
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not update save."
      );
    }

    card.dataset.viewerSaved =
      data.saved ? "true" : "false";

    const count =
      Number(data.save_count) || 0;

    card.dataset.saveCount =
      String(count);

    if (menuSave) {
      menuSave.classList.toggle(
        "menu-item-active",
        data.saved
      );

      menuSave.innerHTML = `
        <span class="menu-item-icon">
          ${data.saved ? "🔖" : "🔖"}
        </span>
        <span>
          ${data.saved ? "Saved" : "Save"}
        </span>
      `;
    }

    closePostActionMenu(postId);

  } catch (error) {
    console.error("Save error:", error);

    alert(
      error.message ||
      "Could not update saved post."
    );

  } finally {
    if (menuSave) menuSave.disabled = false;
  }
}


async function sharePost(postId) {
  const card = getPostCard(postId);

  if (!card) return;

  const username =
    card.querySelector(".post-author-name")
      ?.textContent
      ?.trim() || "VYBE user";

  const content =
    card.querySelector(".post-content")
      ?.textContent
      ?.trim() || "";

  const shareUrl =
    `${window.location.origin}${window.location.pathname}?post=${encodeURIComponent(postId)}`;

  const shareData = {
    title: "VYBE",
    text: `${username}: ${content}`,
    url: shareUrl
  };

  try {
    if (
      navigator.share &&
      typeof navigator.share === "function"
    ) {
      await navigator.share(shareData);
      return;
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(shareUrl);
      alert("Post link copied.");
      return;
    }

    throw new Error(
      "Sharing is not supported on this device."
    );

  } catch (error) {
    if (error?.name === "AbortError") return;

    console.error("Share error:", error);

    alert(
      error.message ||
      "Could not share post."
    );
  }
}


async function copyPostText(postId) {
  const card = getPostCard(postId);
  if (!card) return;

  const content =
    card.querySelector(".post-content")
      ?.textContent
      ?.trim() || "";

  if (!content) {
    alert("There is no text to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(content);
    closePostActionMenu(postId);
    alert("Post text copied.");
  } catch (error) {
    console.error("Copy error:", error);
    alert("Could not copy post text.");
  }
}


async function copyPostLink(postId) {
  const shareUrl =
    `${window.location.origin}${window.location.pathname}?post=${encodeURIComponent(postId)}`;

  try {
    await navigator.clipboard.writeText(shareUrl);
    closePostActionMenu(postId);
    alert("Post link copied.");
  } catch (error) {
    console.error("Copy link error:", error);
    alert("Could not copy post link.");
  }
}


async function forwardPost(postId) {
  const card = document.querySelector(
    `[data-post-id="${CSS.escape(postId)}"]`
  );

  if (!card) return;

  const text =
    card.querySelector(".post-content")?.textContent?.trim() || "";

  const username =
    card.querySelector(".post-author-username")?.dataset.username || "";

  const url =
    `${window.location.origin}/?post=${encodeURIComponent(postId)}`;

  const shareData = {
    title: username ? `VYBE post by @${username}` : "VYBE post",
    text,
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      closeAllPostActionMenus();
      return;
    }

    await navigator.clipboard.writeText(
      `${text}\n\n${url}`
    );

    closeAllPostActionMenus();
    alert("Post link copied. You can forward it anywhere.");
  } catch (error) {
    if (error?.name === "AbortError") return;

    console.error("Forward post error:", error);
    alert("Could not forward this post.");
  }
}


async function reportPost(postId) {
  const reason = window.prompt(
    "Why are you reporting this post?\n\n" +
    "spam\n" +
    "harassment\n" +
    "hate\n" +
    "violence\n" +
    "sexual\n" +
    "misinformation\n" +
    "other"
  );

  if (reason === null) return;

  const normalizedReason =
    reason.trim().toLowerCase();

  const allowedReasons = [
    "spam",
    "harassment",
    "hate",
    "violence",
    "sexual",
    "misinformation",
    "other"
  ];

  if (!allowedReasons.includes(normalizedReason)) {
    alert("Invalid report reason.");
    return;
  }

  const details = window.prompt(
    "Additional details (optional):"
  );

  if (details === null) return;

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/report`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: normalizedReason,
          details: details.trim()
        })
      }
    );

    closeAllPostActionMenus();

    if (data.already_reported) {
      alert("You already reported this post.");
    } else {
      alert("Report submitted.");
    }
  } catch (error) {
    alert(
      error.message ||
      "Could not report this post."
    );
  }
}


function setupPostInteractions() {
  const cards = document.querySelectorAll(
    "[data-post-id]"
  );

  cards.forEach(card => {
    if (card.dataset.interactionsReady === "true") {
      return;
    }

    card.dataset.interactionsReady = "true";

    const postId = card.dataset.postId;

    const commentTrigger =
      card.querySelector(
        `[data-comment-post="${CSS.escape(postId)}"]`
      );

    const shareButton =
      card.querySelector(
        `[data-share-post="${CSS.escape(postId)}"]`
      );

    const repostButton =
      card.querySelector(
        `[data-repost-post="${CSS.escape(postId)}"]`
      );

    const content =
      card.querySelector(".post-content");

    if (commentTrigger) {
      const open = () => openComments(postId);

      commentTrigger.addEventListener(
        "click",
        open
      );

      commentTrigger.addEventListener(
        "keydown",
        event => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            open();
          }
        }
      );
    }

    if (shareButton) {
      shareButton.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          sharePost(postId);
        }
      );
    }

    if (repostButton) {
      repostButton.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          toggleRepost(postId);
        }
      );
    }

    card.querySelectorAll(
      "[data-menu-reaction]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        async event => {
          event.stopPropagation();

          await setReaction(
            postId,
            button.dataset.menuReaction
          );
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-more-reactions]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          const more =
            card.querySelector(
              `[data-more-reactions="${CSS.escape(postId)}"]`
            );

          if (!more) return;

          const opened =
            !more.classList.contains("hidden");

          more.classList.toggle(
            "hidden",
            opened
          );

          button.setAttribute(
            "aria-expanded",
            opened ? "false" : "true"
          );
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-save]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          toggleSave(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-repost]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          toggleRepost(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-share]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          sharePost(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-copy]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          copyPostText(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-copy-link]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          copyPostLink(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-forward]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        async event => {
          event.stopPropagation();
          await forwardPost(postId);
        }
      );
    });

    card.querySelectorAll(
      "[data-menu-report]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        async event => {
          event.stopPropagation();
          await reportPost(postId);
        }
      );
    });

    /*
      Single tap = open menu.
      Double tap = ❤️.
      Long press is intentionally NOT used.
    */
    if (content) {
      content.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          const now = Date.now();

          const dx =
            event.clientX - lastTap.x;

          const dy =
            event.clientY - lastTap.y;

          const distance =
            Math.hypot(dx, dy);

          const isDoubleTap =
            lastTap.postId === postId &&
            now - lastTap.time <= DOUBLE_TAP_MS &&
            distance <= DOUBLE_TAP_DISTANCE;

          if (isDoubleTap) {
            if (tapTimer) {
              clearTimeout(tapTimer);
              tapTimer = null;
            }

            lastTap = {
              postId: null,
              time: 0,
              x: 0,
              y: 0
            };

            setReaction(postId, "like");
            return;
          }

          lastTap = {
            postId,
            time: now,
            x: event.clientX,
            y: event.clientY
          };

          if (tapTimer) {
            clearTimeout(tapTimer);
          }

          tapTimer = setTimeout(() => {
            tapTimer = null;
            openPostActionMenu(postId);
          }, DOUBLE_TAP_MS);
        }
      );
    }

    const author =
      card.querySelector(
        ".post-author"
      );

    const authorName =
      card.querySelector(
        ".post-author-name"
      );

    const authorUsername =
      card.querySelector(
        ".post-author-username"
      );

    const openAuthorProfile = event => {
      event.stopPropagation();

      const username =
        authorUsername?.dataset.username ||
        authorUsername?.textContent
          ?.replace(/^@/, "")
          ?.trim() ||
        "";

      if (username) {
        showPublicProfile(username);
      }
    };

    if (authorName) {
      authorName.addEventListener(
        "click",
        openAuthorProfile
      );
    }

    if (author) {
      const avatar =
        author.querySelector(
          ".post-avatar"
        );

      if (avatar) {
        avatar.style.cursor = "pointer";

        avatar.addEventListener(
          "click",
          openAuthorProfile
        );
      }
    }

    const viewerReaction =
      card.dataset.viewerReaction || "";

    const viewerReposted =
      card.dataset.viewerReposted === "true";

    const viewerSaved =
      card.dataset.viewerSaved === "true";

    card.querySelectorAll(
      "[data-menu-reaction]"
    ).forEach(button => {
      const reaction =
        button.dataset.menuReaction;

      button.classList.toggle(
        "reaction-selected",
        reaction === viewerReaction
      );

      button.setAttribute(
        "aria-pressed",
        reaction === viewerReaction
          ? "true"
          : "false"
      );
    });

    const saveButton =
      card.querySelector(
        `[data-menu-save="${CSS.escape(postId)}"]`
      );

    if (saveButton) {
      saveButton.classList.toggle(
        "menu-item-active",
        viewerSaved
      );

      saveButton.innerHTML = `
        <span class="menu-item-icon">🔖</span>
        <span>${viewerSaved ? "Saved" : "Save"}</span>
      `;
    }

    const repostButtonState =
      card.querySelector(
        `[data-repost-post="${CSS.escape(postId)}"]`
      );

    if (repostButtonState) {
      const repostCount =
        Number(card.dataset.repostCount) || 0;

      repostButtonState.classList.toggle(
        "action-active",
        viewerReposted
      );

      repostButtonState.setAttribute(
        "aria-pressed",
        viewerReposted
          ? "true"
          : "false"
      );

      repostButtonState.innerHTML = `
        <span class="action-icon">🔄</span>
        <span class="action-label">
          Repost${repostCount > 0 ? ` ${repostCount}` : ""}
        </span>
      `;
    }
  });
}


document.addEventListener(
  "click",
  event => {
    if (
      !event.target.closest(".post-action-menu") &&
      !event.target.closest(".post-content")
    ) {
      closeAllPostActionMenus();
    }
  }
);


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




/* --------------------------------
   SEARCH SYSTEM
-------------------------------- */

let searchScreen = null;
let searchTimer = null;

function showSearch() {
  hide(homeScreen);
  hide(authScreen);
  hide(profileScreen);

  if (!searchScreen) {
    searchScreen = document.createElement("section");

    searchScreen.id = "searchScreen";
    searchScreen.className = "screen search-screen";

    searchScreen.innerHTML = `
      <header class="search-topbar">
        <button
          type="button"
          class="search-back"
          id="searchBack"
          aria-label="Back"
        >
          ←
        </button>

        <h1>Search</h1>
      </header>

      <div class="search-input-wrap">
        <span class="search-input-icon">🔎</span>

        <input
          id="searchInput"
          class="search-input"
          type="search"
          autocomplete="off"
          maxlength="50"
          placeholder="Search people..."
          aria-label="Search people"
        />
      </div>

      <div
        id="searchResults"
        class="search-results"
      >
        <div class="search-state">
          <strong>Find people</strong>
          <span>Search by username or name.</span>
        </div>
      </div>
    `;

    document.body.appendChild(searchScreen);

    document
      .getElementById("searchBack")
      .addEventListener("click", () => {
        hide(searchScreen);
        showHome();
      });

    document
      .getElementById("searchInput")
      .addEventListener("input", event => {
        clearTimeout(searchTimer);

        const value = event.target.value.trim();

        if (!value) {
          renderSearchState(
            "Find people",
            "Search by username or name."
          );
          return;
        }

        renderSearchState(
          "Searching…",
          ""
        );

        searchTimer = setTimeout(
          () => searchUsers(value),
          250
        );
      });
  }

  show(searchScreen);

  const input =
    document.getElementById("searchInput");

  input?.focus();
}

function renderSearchState(title, message) {
  const results =
    document.getElementById("searchResults");

  if (!results) return;

  results.innerHTML = `
    <div class="search-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

async function searchUsers(term) {
  try {
    const data = await api(
      `/api/search/users?q=${encodeURIComponent(term)}`
    );

    const users = data.users || [];

    if (users.length === 0) {
      renderSearchState(
        "No people found",
        `No users match "${term}".`
      );
      return;
    }

    const results =
      document.getElementById("searchResults");

    if (!results) return;

    results.innerHTML = users.map(user => {
      const name =
        user.display_name ||
        user.username ||
        "VYBE";

      const initial =
        name.charAt(0).toUpperCase();

      const followers =
        Number(user.followers_count || 0);

      return `
        <button
          type="button"
          class="search-user"
          data-search-username="${escapeHtml(
            user.username
          )}"
        >
          <span class="search-user-avatar">
            ${escapeHtml(initial)}
          </span>

          <span class="search-user-info">
            <span class="search-user-name">
              ${escapeHtml(name)}
              ${user.is_verified ? " ✓" : ""}
            </span>

            <span class="search-user-username">
              @${escapeHtml(user.username)}
            </span>

            <span class="search-user-followers">
              ${followers} follower${followers === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      `;
    }).join("");

    results
      .querySelectorAll("[data-search-username]")
      .forEach(button => {
        button.addEventListener("click", () => {
          showPublicProfile(
            button.dataset.searchUsername
          );
        });
      });

  } catch (error) {
    console.error("Search error:", error);

    renderSearchState(
      "Couldn't search",
      error.message || "Please try again."
    );
  }
}

/* --------------------------------
   SEARCH NAVIGATION
-------------------------------- */

document.addEventListener("click", event => {
  const navItem = event.target.closest(
    '.nav-item[data-nav="explore"]'
  );

  if (!navItem) return;

  event.preventDefault();
  event.stopPropagation();

  if (!state.authenticated) {
    return;
  }

  showSearch();
});

/* --------------------------------
   HOME NAVIGATION
-------------------------------- */

document
  .querySelector('[data-nav="home"]')
  .addEventListener("click", event => {
    event.preventDefault();
    showHome();
  });

/* --------------------------------
   ACTIVITY / NOTIFICATIONS SCREEN
-------------------------------- */

let activityScreen = null;
let activityNotifications = [];
let activityUnreadCount = 0;

function notificationText(notification) {
  const name = notification.actor_display_name ||
    notification.actor_username ||
    "Someone";

  switch (notification.type) {
    case "follow":
      return `${name} started following you`;
    case "reaction":
      return `${name} reacted to your post`;
    case "comment":
      return `${name} commented on your post`;
    case "repost":
      return `${name} reposted your post`;
    default:
      return `${name} interacted with you`;
  }
}

function notificationIcon(type) {
  switch (type) {
    case "follow":
      return "♡";
    case "reaction":
      return "♥";
    case "comment":
      return "💬";
    case "repost":
      return "↻";
    default:
      return "•";
  }
}

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;

  return date.toLocaleDateString();
}

function renderActivityNotifications() {
  if (!activityScreen) return;

  const content = activityScreen.querySelector(".activity-content");

  if (!activityNotifications.length) {
    content.innerHTML = `
      <div class="activity-empty">
        <div class="activity-empty-icon">♡</div>
        <h2>No activity yet</h2>
        <p>
          Your likes, follows, comments and reposts
          will appear here.
        </p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="activity-list">
      ${activityNotifications.map(notification => {
        const unread = !notification.read_at;

        return `
          <button
            class="activity-item ${unread ? "is-unread" : ""}"
            type="button"
            data-notification-id="${notification.id}"
          >
            <div class="activity-avatar">
              ${notification.actor_avatar_url
                ? `<img src="${escapeHtml(notification.actor_avatar_url)}" alt="">`
                : escapeHtml(
                    (notification.actor_display_name ||
                     notification.actor_username ||
                     "?").charAt(0).toUpperCase()
                  )
              }
            </div>

            <div class="activity-item-main">
              <div class="activity-item-text">
                <span class="activity-icon">
                  ${notificationIcon(notification.type)}
                </span>
                <span>${escapeHtml(notificationText(notification))}</span>
              </div>

              <div class="activity-item-time">
                ${formatNotificationTime(notification.created_at)}
              </div>
            </div>

            ${unread ? '<span class="activity-unread-dot"></span>' : ""}
          </button>
        `;
      }).join("")}
    </div>

    ${activityUnreadCount > 0 ? `
      <button
        id="markAllNotificationsRead"
        class="activity-read-all"
        type="button"
      >
        Mark all as read
      </button>
    ` : ""}
  `;

  content.querySelectorAll("[data-notification-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.notificationId;

      await api(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PUT"
      });

      const notification = activityNotifications.find(item => item.id === id);

      if (notification && !notification.read_at) {
        notification.read_at = new Date().toISOString();
        activityUnreadCount = Math.max(0, activityUnreadCount - 1);
      }

      updateNotificationBadge();
      renderActivityNotifications();
    });
  });

  const readAllButton =
    content.querySelector("#markAllNotificationsRead");

  if (readAllButton) {
    readAllButton.addEventListener("click", markAllNotificationsRead);
  }
}

async function loadActivityNotifications() {
  try {
    const data = await api("/api/notifications");

    if (!data.success) {
      throw new Error(data.error || "Could not load notifications");
    }

    activityNotifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    activityUnreadCount = Number(data.unread_count) || 0;

    updateNotificationBadge();
    renderActivityNotifications();
  } catch (error) {
    console.error("Activity notifications error:", error);

    const content = activityScreen?.querySelector(".activity-content");

    if (content) {
      content.innerHTML = `
        <div class="activity-empty">
          <div class="activity-empty-icon">!</div>
          <h2>Could not load activity</h2>
          <p>Please try again.</p>
          <button
            id="retryActivity"
            class="activity-retry"
            type="button"
          >
            Retry
          </button>
        </div>
      `;

      content
        .querySelector("#retryActivity")
        ?.addEventListener("click", loadActivityNotifications);
    }
  }
}

async function markAllNotificationsRead() {
  try {
    const data = await api("/api/notifications/read-all", {
      method: "PUT"
    });

    if (!data.success) {
      throw new Error(data.error || "Could not mark notifications as read");
    }

    activityNotifications.forEach(notification => {
      notification.read_at = notification.read_at ||
        new Date().toISOString();
    });

    activityUnreadCount = 0;

    updateNotificationBadge();
    renderActivityNotifications();
  } catch (error) {
    console.error("Mark notifications read error:", error);
  }
}

function updateNotificationBadge() {
  const button = document.querySelector("#notificationsButton");
  if (!button) return;

  button.classList.toggle("has-unread", activityUnreadCount > 0);

  let badge = button.querySelector(".notification-badge");

  if (activityUnreadCount > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notification-badge";
      button.appendChild(badge);
    }

    badge.textContent =
      activityUnreadCount > 99 ? "99+" : String(activityUnreadCount);
  } else if (badge) {
    badge.remove();
  }
}

function showActivity() {
  hide(splashScreen);
  hide(homeScreen);
  hide(authScreen);
  hide(profileScreen);

  if (typeof searchScreen !== "undefined" && searchScreen) {
    hide(searchScreen);
  }

  if (!activityScreen) {
    activityScreen = document.createElement("section");
    activityScreen.id = "activityScreen";
    activityScreen.className = "screen activity-screen";

    activityScreen.innerHTML = `
      <header class="activity-topbar">
        <h1>Activity</h1>
      </header>

      <main class="activity-content">
        <div class="activity-empty">
          <div class="activity-empty-icon">…</div>
          <h2>Loading activity</h2>
        </div>
      </main>
    `;

    document.body.appendChild(activityScreen);
  }

  show(activityScreen);
  loadActivityNotifications();
}

document
  .querySelector('[data-nav="activity"]')
  .addEventListener("click", event => {
    event.preventDefault();
    showActivity();
  });

document
  .querySelector("#notificationsButton")
  ?.addEventListener("click", event => {
    event.preventDefault();
    showActivity();
  });

if (state.authenticated) {
  loadActivityNotifications();
}

document
  .querySelector('[data-nav="activity"]')
  .addEventListener("click", event => {
    event.preventDefault();
    showActivity();
  });
