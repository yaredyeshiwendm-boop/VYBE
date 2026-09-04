"use strict";

const state = {
  user: null,
  authenticated: false,
  createPostMedia: [],
  stories: [],
  activeStoryIndex: -1
};

const $ = (selector) => document.querySelector(selector);

const splashScreen = $("#splashScreen");
const authScreen = $("#authScreen");
const homeScreen = $("#homeScreen");
const bottomNav = $(".bottom-nav");

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

function hideDynamicScreens() {
  document
    .querySelectorAll("#vybzScreen, #dmScreen, #searchScreen, #activityScreen")
    .forEach(screen => {
      screen.classList.add("hidden");
    });
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
  hide(bottomNav);
  show(authScreen);
}

function showHome() {
  hideDynamicScreens();
  setActiveNav?.("home");
  show(bottomNav);
  hide(splashScreen);
  hide(authScreen);
  hide(profileScreen);

  if (typeof searchScreen !== "undefined" && searchScreen) {
    hide(searchScreen);
  }

  show(homeScreen);

  loadStories();
  loadPosts();
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
    console.log("[VYBE AUTH] checking session", {
      origin: window.location.origin,
      cookiesEnabled: navigator.cookieEnabled
    });

    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    const data = await response.json();

    console.log("[VYBE AUTH] /api/auth/me", {
      status: response.status,
      success: data.success,
      hasUser: !!data.user
    });

    if (response.ok && data.success && data.user) {
      state.user = data.user;
      state.authenticated = true;
      loadActivityNotifications();
      showHome();
      return true;
    }
  } catch (error) {
    console.error("[VYBE AUTH] session check failed:", error);
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
  hideDynamicScreens();
  show(bottomNav);
  setActiveNav?.("profile");
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
    hideDynamicScreens();
    show(bottomNav);
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

${renderVYBEPostMedia(post.media)}



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
            ${vybeIcon("repost")} <span data-repost-label>Repost</span>
            <span data-repost-count>
              ${repostCount}
            </span>
          </button>

          <button
            type="button"
            class="post-action-button"
            data-share-post="${escapeHtml(post.id)}"
          >
            ${vybeIcon("share")} Share
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
            <span class="menu-item-icon">${vybeIcon("save")}</span>
            <span>Save</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-repost="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">${vybeIcon("repost")}</span>
            <span>Repost</span>
          </button>

          <button
            type="button"
            class="post-menu-item"
            data-menu-share="${escapeHtml(post.id)}"
          >
            <span class="menu-item-icon">${vybeIcon("share")}</span>
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

  initVYBEVideoPlayers(container);

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

    state.posts = Array.isArray(data.posts)
      ? data.posts
      : [];

    renderPosts(state.posts);
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

        ${
          Array.isArray(post.media) && post.media.length
            ? renderVYBEPostMedia(post.media, {
                postId: post.id,
                username: post.username,
                displayName: name
              })
            : `
              <div class="post-content">
                ${escapeHtml(post.content || "")}
              </div>
            `
        }

        ${
          Array.isArray(post.media) &&
          post.media.length &&
          post.content
            ? `
              <div class="vybe-post-caption">
                <span class="vybe-caption-label">Caption</span>
                <div class="vybe-caption-text">
                  ${escapeHtml(post.content)}
                </div>
              </div>
            `
            : ""
        }

        <div class="vybe-post-meta">

          <div class="vybe-post-actions">

            <button
              type="button"
              class="vybe-post-action ${post.viewer_reaction === "like" ? "action-active" : ""}"
              data-vybe-like="${escapeHtml(post.id)}"
              aria-label="Like"
              aria-pressed="${post.viewer_reaction === "like" ? "true" : "false"}"
            >
              ${vybeIcon("like", Boolean(post.viewer_reaction))}
              <small>${formatVYBECount(
                Number(reactionCounts.like || 0)
              )}</small>
            </button>

            <button
              type="button"
              class="vybe-post-action ${post.viewer_saved ? "action-active" : ""}"
              data-vybe-save="${escapeHtml(post.id)}"
              aria-label="Save"
              aria-pressed="${post.viewer_saved ? "true" : "false"}"
            >
              ${vybeIcon("save", Boolean(post.viewer_saved))}
              <small>${formatVYBECount(
                Number(post.save_count || 0)
              )}</small>
            </button>

            <button
              type="button"
              class="vybe-post-action"
              data-vybe-share="${escapeHtml(post.id)}"
              aria-label="Share"
            >
              ${vybeIcon("share")}
              <small>Share</small>
            </button>

            <button
              type="button"
              class="vybe-post-action ${post.viewer_reposted ? "action-active" : ""}"
              data-vybe-repost="${escapeHtml(post.id)}"
              aria-label="Repost"
              aria-pressed="${post.viewer_reposted ? "true" : "false"}"
            >
              ${vybeIcon("repost", Boolean(post.viewer_reposted))}
              <small>${formatVYBECount(
                Number(post.repost_count || 0)
              )}</small>
            </button>

          </div>

          <button
            type="button"
            class="vybe-post-comments-row"
            data-vybe-comment="${escapeHtml(post.id)}"
            aria-label="View comments"
          >
            ${vybeIcon("comment")}
            <span class="vybe-comment-text">
              View comments
            </span>
            <span
              class="vybe-comment-count"
              data-comment-count="${escapeHtml(post.id)}"
            >0</span>
            <span class="vybe-comment-arrow">›</span>
          </button>

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
              <span class="action-icon">${vybeIcon("repost")}</span>
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
              <span class="action-icon">${vybeIcon("share")}</span>
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
                <span class="menu-item-icon">${vybeIcon("save")}</span>
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
                <span class="menu-item-icon">${vybeIcon("repost")}</span>
                <span class="menu-item-text">Repost</span>
              </button>

              <button
                type="button"
                class="post-menu-item"
                data-menu-share="${escapeHtml(post.id)}"
                role="menuitem"
              >
                <span class="menu-item-icon">${vybeIcon("share")}</span>
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

  initVYBEVideoPlayers(postsFeed);
  setupVYBEPostActions(postsFeed);

  postsFeed
    .querySelectorAll("[data-delete-post]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => deletePost(button.dataset.deletePost)
      );
    });

  postsFeed
    .querySelectorAll("[data-vybe-comment]")
    .forEach(button => {
      loadCommentCount(
        button.dataset.vybeComment,
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
        <div class="comments-empty-icon">${vybeIcon("comment")}</div>
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
  const safePostId = CSS.escape(String(postId));

  const cards = document.querySelectorAll(
    `.post-card[data-post-id="${safePostId}"],
     .vybz-item[data-post-id="${safePostId}"]`
  );

  cards.forEach(card => {
    const countElement =
      card.querySelector(
        `[data-comment-count="${safePostId}"]`
      ) ||
      card.querySelector(".vybe-comment-count") ||
      card.querySelector("[data-vybe-comment] small");

    if (countElement) {
      countElement.textContent =
        formatVYBECount(count);
    }
  });
}

async function loadCommentCount(postId, button) {
  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/comments`
    );

    if (!data.success) return;

    const count =
      (data.comments || []).length;

    const safePostId = CSS.escape(String(postId));

    const countElements = document.querySelectorAll(
      `[data-comment-count="${safePostId}"]`
    );

    countElements.forEach(countElement => {
      countElement.textContent =
        formatVYBECount(count);
    });

    if (button) {
      const fallback =
        button.querySelector(".vybe-comment-count") ||
        button.querySelector("small");

      if (
        fallback &&
        !fallback.matches(
          `[data-comment-count="${safePostId}"]`
        )
      ) {
        fallback.textContent =
          formatVYBECount(count);
      }
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

    syncVYBEHomeActionUI(postId, {
      liked: currentReaction !== reactionType,
      likeCount: Number(data.reaction_counts?.like) || 0
    });

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

  const safePostId = CSS.escape(String(postId));

  const button =
    card.querySelector(`[data-vybe-repost="${safePostId}"]`) ||
    card.querySelector(`[data-repost-post="${safePostId}"]`);

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

    syncVYBEHomeActionUI(postId, {
      reposted: Boolean(data.reposted),
      repostCount: count
    });

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
        <span class="action-icon">${vybeIcon("repost")}</span>
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

    syncVYBEHomeActionUI(postId, {
      saved: Boolean(data.saved),
      saveCount: count
    });

    if (menuSave) {
      menuSave.classList.toggle(
        "menu-item-active",
        data.saved
      );

      menuSave.innerHTML = `
        <span class="menu-item-icon">
          ${vybeIcon("save", Boolean(data.saved))}
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



function syncVYBEHomeActionUI(postId, values = {}) {
  const id = String(postId);
  const safeId = CSS.escape(id);

  document
    .querySelectorAll(`.post-card[data-post-id="${safeId}"]`)
    .forEach(card => {

      if (
        values.liked !== undefined ||
        values.likeCount !== undefined
      ) {
        const button = card.querySelector(
          `[data-vybe-like="${safeId}"]`
        );

        if (button) {
          const count = Number(values.likeCount) || 0;

          button.classList.toggle(
            "action-active",
            Boolean(values.liked)
          );

          button.setAttribute(
            "aria-pressed",
            values.liked ? "true" : "false"
          );

          const icon = button.querySelector("span");
          const countEl = button.querySelector("small");

          if (icon) {
            icon.innerHTML = vybeIcon("like", Boolean(values.liked));
          }

          if (countEl) {
            countEl.textContent = formatVYBECount(count);
          }
        }

        card.dataset.viewerReaction =
          values.liked ? "like" : "";

        card.dataset.likeCount =
          String(Number(values.likeCount) || 0);
      }

      if (
        values.saved !== undefined ||
        values.saveCount !== undefined
      ) {
        const button = card.querySelector(
          `[data-vybe-save="${safeId}"]`
        );

        if (button) {
          const count = Number(values.saveCount) || 0;

          button.classList.toggle(
            "action-active",
            Boolean(values.saved)
          );

          button.setAttribute(
            "aria-pressed",
            values.saved ? "true" : "false"
          );

          const countEl = button.querySelector("small");

          if (countEl) {
            countEl.textContent = formatVYBECount(count);
          }
        }

        card.dataset.viewerSaved =
          values.saved ? "true" : "false";

        card.dataset.saveCount =
          String(Number(values.saveCount) || 0);
      }

      if (
        values.reposted !== undefined ||
        values.repostCount !== undefined
      ) {
        const button = card.querySelector(
          `[data-vybe-repost="${safeId}"]`
        );

        if (button) {
          const count = Number(values.repostCount) || 0;

          button.classList.toggle(
            "action-active",
            Boolean(values.reposted)
          );

          button.setAttribute(
            "aria-pressed",
            values.reposted ? "true" : "false"
          );

          const icon = button.querySelector("span");
          const countEl = button.querySelector("small");

          if (icon) {
            icon.innerHTML = vybeIcon("repost", Boolean(values.reposted));
          }

          if (countEl) {
            countEl.textContent = formatVYBECount(count);
          }
        }

        card.dataset.viewerReposted =
          values.reposted ? "true" : "false";

        card.dataset.repostCount =
          String(Number(values.repostCount) || 0);
      }
    });
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


function setupVYBEPostActions(root = document) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll("[data-vybe-like]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      setReaction(
        button.dataset.vybeLike,
        "like"
      );
    });
  });

  root.querySelectorAll("[data-vybe-comment]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      openComments(button.dataset.vybeComment);
    });
  });

  root.querySelectorAll("[data-vybe-save]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      toggleSave(button.dataset.vybeSave);
    });
  });

  root.querySelectorAll("[data-vybe-repost]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      toggleRepost(button.dataset.vybeRepost);
    });
  });

  root.querySelectorAll("[data-vybe-share]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      sharePost(button.dataset.vybeShare);
    });
  });

  root.querySelectorAll("[data-vybe-follow]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const username =
        button.dataset.vybeFollow;

      if (username) {
        showPublicProfile(username);
      }
    });
  });

  root.querySelectorAll("[data-vybe-open-video]").forEach(videoWrap => {
    if (videoWrap.dataset.vybeReady === "true") return;

    videoWrap.dataset.vybeReady = "true";

    videoWrap.addEventListener("click", event => {
      if (
        event.target.closest("[data-vybe-video-play]") ||
        event.target.closest("[data-vybe-video-mute]") ||
        event.target.closest("[data-vybe-video-fullscreen]") ||
        event.target.closest("[data-vybe-video-progress]")
      ) {
        return;
      }

      const postId =
        videoWrap.dataset.vybeOpenVideo;

      if (postId) {
        showVybz(postId);
      }
    });
  });
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
      Double tap = Like.
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
        <span class="menu-item-icon">${vybeIcon("save")}</span>
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
        <span class="action-icon">${vybeIcon("repost")}</span>
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



function getMediaUrl(url) {
  if (!url) return "";

  try {
    return new URL(
      String(url),
      window.location.origin
    ).href;
  } catch {
    return "";
  }
}

async function loadStories() {
  const feed = document.getElementById("storiesFeed");
  if (!feed) return;

  feed.innerHTML = `
    <div class="stories-loading">
      Loading stories...
    </div>
  `;

  try {
    const data = await api("/api/stories");
    state.stories = data.stories || [];
    renderStories();
  } catch (error) {
    feed.innerHTML = `
      <div class="stories-error">
        Couldn't load stories.
      </div>
    `;
  }
}

function renderStories() {
  const feed = document.getElementById("storiesFeed");
  if (!feed) return;

  const ownStory = state.stories.find(
    story => String(story.user_id) === String(state.user?.id)
  );

  const users = [];
  const seen = new Set();

  if (ownStory) {
    users.push(ownStory);
    seen.add(String(ownStory.user_id));
  }

  for (const story of state.stories) {
    const uid = String(story.user_id);

    if (!seen.has(uid)) {
      users.push(story);
      seen.add(uid);
    }
  }

  const addCard = !ownStory
    ? `
      <button
        class="story-card story-add-card"
        id="emptyAddStory"
        type="button"
        aria-label="Add your story"
      >
        <span class="story-avatar story-empty-avatar">
          <span class="story-add-plus">+</span>
        </span>
        <span class="story-name">Your story</span>
      </button>
    `
    : "";

  feed.innerHTML =
    addCard +
    users.map(story => {
      const name =
        story.display_name ||
        story.username ||
        "VYBER";

      const initial =
        name.charAt(0).toUpperCase();

      const viewed =
        story.viewer_viewed ? " viewed" : "";

      const mine =
        String(story.user_id) === String(state.user?.id);

      return `
        <button
          class="story-card${viewed}${mine ? " own-story" : ""}"
          type="button"
          data-story-user="${escapeHtml(story.user_id)}"
          aria-label="View ${escapeHtml(name)}'s story"
        >
          <span class="story-avatar">

            ${
              story.url
                ? story.media_type === "video"
                  ? `<video
                       class="story-thumbnail"
                       src="${escapeHtml(getMediaUrl(story.url))}"
                       muted
                       playsinline
                     ></video>`
                  : `<img
                       class="story-thumbnail"
                       src="${escapeHtml(getMediaUrl(story.url))}"
                       alt=""
                     >`
                : escapeHtml(initial)
            }

            ${
              mine
                ? `<span class="story-own-plus">+</span>`
                : ""
            }

          </span>

          <span class="story-name">
            ${escapeHtml(mine ? "Your story" : name)}
          </span>
        </button>
      `;
    }).join("");
}

function openCreateStory() {
  const modal =
    document.getElementById("createStoryModal");

  const input =
    document.getElementById("storyMediaInput");

  const caption =
    document.getElementById("storyCaption");

  const error =
    document.getElementById("createStoryError");

  clearError(error);

  input.value = "";
  caption.value = "";

  document.getElementById("storyMediaPreview")
    .innerHTML = "";

  document.getElementById("storyMediaPreview")
    .classList.add("hidden");

  state.createStoryMedia = null;

  show(modal);
}

function closeCreateStory() {
  hide(document.getElementById("createStoryModal"));
}

async function handleStoryMediaSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const error =
    document.getElementById("createStoryError");

  clearError(error);

  try {
    const media = await uploadPostMedia(file);

    state.createStoryMedia = media;

    const preview =
      document.getElementById("storyMediaPreview");

    const url = escapeHtml(media.url);

    preview.innerHTML =
      media.media_type === "video"
        ? renderVYBEVideoPlayer(media, {
            compact: true
          })
        : `<div class="vybe-story-photo-preview">
             <img src="${url}" alt="Story preview">
           </div>`;

    preview.classList.remove("hidden");
  } catch (errorValue) {
    state.createStoryMedia = null;

    showError(
      error,
      errorValue.message ||
      "Could not upload story media."
    );
  } finally {
    event.target.value = "";
  }
}

async function createStory(event) {
  event.preventDefault();

  const error =
    document.getElementById("createStoryError");

  const button =
    document.getElementById("publishStoryButton");

  clearError(error);

  if (!state.createStoryMedia?.id) {
    showError(
      error,
      "Choose a photo or video first."
    );
    return;
  }

  const caption =
    document.getElementById("storyCaption")
      .value.trim();

  setButtonLoading(button, true);

  try {
    await api("/api/stories", {
      method: "POST",
      body: JSON.stringify({
        media_id: state.createStoryMedia.id,
        caption
      })
    });

    state.createStoryMedia = null;

    closeCreateStory();
    await loadStories();
  } catch (errorValue) {
    showError(
      error,
      errorValue.message ||
      "Could not share story."
    );
  } finally {
    setButtonLoading(
      button,
      false,
      "Share Story"
    );
  }
}

function openStoryByUser(userId) {
  const index = state.stories.findIndex(
    story => story.user_id === userId
  );

  if (index < 0) return;

  const story = state.stories[index];

  // /api/stories returns media fields directly on the story row.
  if (!story.url) {
    console.error("Story media URL missing:", story);
    return;
  }

  state.activeStoryIndex = index;
  renderActiveStory();
}

let storyTimer = null;
let storyPaused = false;
let storyHoldStart = 0;
let storyTouchStartX = 0;
let storyTouchStartY = 0;

function clearStoryTimer() {
  if (storyTimer) {
    clearTimeout(storyTimer);
    storyTimer = null;
  }
}

function buildStoryProgress() {
  const el = document.getElementById("storyProgress");
  if (!el) return;

  el.innerHTML = state.stories.map((_, i) => `
    <div class="story-progress-segment ${i < state.activeStoryIndex ? "done" : ""}">
      <div class="story-progress-fill"></div>
    </div>
  `).join("");
}

function startStoryProgress(duration) {
  const el = document.getElementById("storyProgress");
  if (!el) return;

  const segments = el.querySelectorAll(".story-progress-segment");
  const current = segments[state.activeStoryIndex];
  const fill = current?.querySelector(".story-progress-fill");

  if (!fill) return;

  fill.style.transition = "none";
  fill.style.width = "0%";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.transition = `width ${duration}ms linear`;
      fill.style.width = "100%";
    });
  });
}

async function renderActiveStory() {
  clearStoryTimer();

  const story = state.stories[state.activeStoryIndex];
  if (!story) {
    closeStoryViewer();
    return;
  }

  storyPaused = false;

  const viewer = document.getElementById("storyViewer");
  const content = document.getElementById("storyViewerContent");
  const userBox = document.getElementById("storyViewerUser");
  const deleteButton = document.getElementById("storyDeleteButton");
  const likeButton = document.getElementById("storyLikeButton");

  buildStoryProgress();

  viewer.classList.remove("paused");

  if (userBox) {
    userBox.textContent =
      story.display_name || story.username || "VYBER";
  }

  if (deleteButton) {
    deleteButton.classList.toggle(
      "hidden",
      String(story.user_id) !== String(state.user?.id)
    );
  }

  if (likeButton) {
    likeButton.innerHTML = vybeIcon("like", Boolean(story.viewer_reaction));
  }

  content.innerHTML = "";

  const mediaWrap = document.createElement("div");
  mediaWrap.className = "story-viewer-media";

  const url = getMediaUrl(story.url);
  let media;
  let duration = 5000;

  if (
    story.media_type === "video" ||
    String(story.mime_type || "").startsWith("video/")
  ) {
    media = document.createElement("video");
    media.src = url;
    media.autoplay = true;
    media.playsInline = true;
    media.controls = false;
    media.preload = "auto";

    media.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        duration = media.duration * 1000;
        startStoryProgress(duration);
        clearStoryTimer();

        if (!storyPaused) {
          storyTimer = setTimeout(() => {
            if (!storyPaused) showNextStory();
          }, duration);
        }
      }
    });

    media.addEventListener("ended", () => {
      if (!storyPaused) showNextStory();
    });
  } else {
    media = document.createElement("img");
    media.src = url;
    media.alt = `${story.display_name || story.username || "VYBER"}'s story`;
    duration = 5000;
  }

  mediaWrap.appendChild(media);
  content.appendChild(mediaWrap);

  if (story.caption) {
    const caption = document.createElement("p");
    caption.className = "story-viewer-caption";
    caption.textContent = story.caption;
    content.appendChild(caption);
  }

  show(viewer);

  if (
    story.media_type !== "video" &&
    !String(story.mime_type || "").startsWith("video/")
  ) {
    startStoryProgress(5000);
    storyTimer = setTimeout(() => {
      if (!storyPaused) showNextStory();
    }, 5000);
  }

  try {
    if (!story.viewer_viewed) {
      await api(
        `/api/stories/${encodeURIComponent(story.id)}/view`,
        { method: "POST" }
      );

      story.viewer_viewed = true;
      renderStories();
    }
  } catch (error) {
    console.error("Story view error:", error);
  }
}

function pauseStory() {
  if (storyPaused) return;

  storyPaused = true;
  clearStoryTimer();

  document.getElementById("storyViewer")?.classList.add("paused");

  const video = document.querySelector("#storyViewerContent video");
  if (video && !video.paused) {
    video.pause();
  }
}

function resumeStory() {
  if (!storyPaused) return;

  storyPaused = false;

  document.getElementById("storyViewer")?.classList.remove("paused");

  const video = document.querySelector("#storyViewerContent video");

  if (video) {
    video.play().catch(() => {});
  }

  const story = state.stories[state.activeStoryIndex];
  if (!story) return;

  if (
    story.media_type === "video" ||
    String(story.mime_type || "").startsWith("video/")
  ) {
    if (video && Number.isFinite(video.duration)) {
      const remaining =
        Math.max(300, (video.duration - video.currentTime) * 1000);

      storyTimer = setTimeout(() => {
        if (!storyPaused) showNextStory();
      }, remaining);
    }
  } else {
    storyTimer = setTimeout(() => {
      if (!storyPaused) showNextStory();
    }, 5000);
  }
}

function closeStoryViewer() {
  clearStoryTimer();

  const viewer = document.getElementById("storyViewer");
  const content = document.getElementById("storyViewerContent");

  hide(viewer);

  if (content) {
    content.innerHTML = "";
  }

  state.activeStoryIndex = -1;
  storyPaused = false;
}

function showPreviousStory() {
  if (!state.stories.length) return;

  state.activeStoryIndex =
    Math.max(0, state.activeStoryIndex - 1);

  renderActiveStory();
}

function showNextStory() {
  if (!state.stories.length) return;

  if (state.activeStoryIndex >= state.stories.length - 1) {
    closeStoryViewer();
    return;
  }

  state.activeStoryIndex++;
  renderActiveStory();
}

function openCreatePost() {
  clearError(document.getElementById("createPostError"));

  document.getElementById("postContent").value = "";
  document.getElementById("postCharacterCount").textContent = "0";

  state.createPostMedia = [];
  renderPostMediaPreview();

  show(createPostModal);

  setTimeout(() => {
    document.getElementById("postContent").focus();
  }, 100);
}

function closeCreatePost() {
  hide(createPostModal);
}

async function uploadPostMedia(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/media", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || "Could not upload media."
    );
  }

  return data.media;
}

function renderPostMediaPreview() {
  const preview =
    document.getElementById("postMediaPreview");

  if (!preview) return;

  if (!state.createPostMedia.length) {
    preview.innerHTML = "";
    preview.classList.add("hidden");
    return;
  }

  preview.classList.remove("hidden");

  preview.innerHTML = state.createPostMedia
    .map((media, index) => {
      const isVideo =
        media.media_type === "video";

      return `
        <div class="post-media-preview-item">
          ${
            isVideo
              ? renderVYBEVideoPlayer(media, {
                  compact: true
                })
              : `<div class="vybe-photo-trigger">
                   <img
                     src="${escapeHtml(media.url)}"
                     alt="Selected media"
                   >
                 </div>`
          }

          <button
            type="button"
            class="post-media-remove"
            data-remove-media-index="${index}"
            aria-label="Remove media"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
      `;
    })
    .join("");
}

async function handlePostMediaSelection(event) {
  const files = Array.from(event.target.files || []);

  if (!files.length) return;

  const errorElement =
    document.getElementById("createPostError");

  clearError(errorElement);

  if (
    state.createPostMedia.length +
    files.length > 4
  ) {
    showError(
      errorElement,
      "You can attach up to 4 media files."
    );

    event.target.value = "";
    return;
  }

  const button =
    document.getElementById("publishPostButton");

  button.disabled = true;

  try {
    for (const file of files) {
      const media = await uploadPostMedia(file);
      state.createPostMedia.push(media);
      renderPostMediaPreview();
    }
  } catch (error) {
    showError(
      errorElement,
      error.message || "Could not upload media."
    );
  } finally {
    button.disabled = false;
    event.target.value = "";
  }
}

async function createPost(event) {
  event.preventDefault();

  const content =
    document.getElementById("postContent").value.trim();

  const errorElement =
    document.getElementById("createPostError");

  const button =
    document.getElementById("publishPostButton");

  clearError(errorElement);

  if (
    !content &&
    !state.createPostMedia.length
  ) {
    showError(
      errorElement,
      "Write something or add a photo/video."
    );
    return;
  }

  setButtonLoading(button, true);

  try {
    const mediaIds =
      state.createPostMedia.map(media => media.id);

    await api(
      "/api/posts",
      {
        method: "POST",
        body: JSON.stringify({
          content,
          media_ids: mediaIds
        })
      }
    );

    state.createPostMedia = [];
    renderPostMediaPreview();

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





/* --------------------------------
   SEARCH SYSTEM
-------------------------------- */

let searchScreen = null;
let searchTimer = null;
let explorePostsLoaded = false;

/* --------------------------------
   EXPLORE / SEARCH SCREEN
-------------------------------- */

function showSearch() {
  hideDynamicScreens();
  show(bottomNav);
  setActiveNav?.("explore");
  hide(homeScreen);
  hide(authScreen);
  hide(profileScreen);

  if (!searchScreen) {
    searchScreen = document.createElement("section");

    searchScreen.id = "searchScreen";
    searchScreen.className = "screen search-screen";

    searchScreen.innerHTML = `
      <header class="search-topbar">
        <h1>Explore</h1>
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
      ></div>

      <section class="explore-discover">
        <div class="explore-section-title">
          <div>
            <strong>Discover on VYBE</strong>
            <span>Posts from the VYBE community</span>
          </div>

          <button
            type="button"
            class="explore-refresh"
            id="exploreRefresh"
            aria-label="Refresh Explore"
          >
            ${vybeIcon("repost")}
          </button>
        </div>

        <div
          id="exploreGrid"
          class="explore-grid"
        >
          <div class="explore-state">
            <div class="explore-state-icon">✦</div>
            <strong>Discovering...</strong>
            <span>Finding posts for you.</span>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(searchScreen);

    document
      .getElementById("searchInput")
      .addEventListener("input", event => {
        clearTimeout(searchTimer);

        const value = event.target.value.trim();

        if (!value) {
          renderSearchState("", "");
          loadExplorePosts();
          return;
        }

        renderSearchState("Searching…", "");

        searchTimer = setTimeout(
          () => searchUsers(value),
          250
        );
      });

    document
      .getElementById("exploreRefresh")
      ?.addEventListener("click", () => {
        loadExplorePosts(true);
      });

    loadExplorePosts();
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

  if (!title && !message) {
    results.innerHTML = "";
    return;
  }

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
   EXPLORE DISCOVER GRID
-------------------------------- */

async function loadExplorePosts(force = false) {
  if (explorePostsLoaded && !force) return;

  const grid =
    document.getElementById("exploreGrid");

  if (!grid) return;

  grid.innerHTML = `
    <div class="explore-state">
      <div class="explore-state-icon">✦</div>
      <strong>Discovering...</strong>
      <span>Finding posts for you.</span>
    </div>
  `;

  try {
    const data = await api("/api/posts");

    const posts = Array.isArray(data.posts)
      ? data.posts
      : [];

    explorePostsLoaded = true;

    renderExplorePosts(posts);

  } catch (error) {
    console.error("Explore posts error:", error);

    grid.innerHTML = `
      <div class="explore-state">
        <div class="explore-state-icon">!</div>
        <strong>Couldn't load Explore</strong>
        <span>${escapeHtml(
          error.message || "Please try again."
        )}</span>

        <button
          type="button"
          class="explore-retry"
          id="exploreRetry"
        >
          Try again
        </button>
      </div>
    `;

    document
      .getElementById("exploreRetry")
      ?.addEventListener("click", () => {
        loadExplorePosts(true);
      });
  }
}

function renderExplorePosts(posts) {
  const grid =
    document.getElementById("exploreGrid");

  if (!grid) return;

  if (!posts.length) {
    grid.innerHTML = `
      <div class="explore-state">
        <div class="explore-state-icon">✦</div>
        <strong>No posts yet</strong>
        <span>Be the first one to post on VYBE.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = posts.map(post => {
    const media =
      Array.isArray(post.media)
        ? post.media[0]
        : null;

    const username =
      post.username || "";

    const displayName =
      post.display_name ||
      username ||
      "VYBE";

    if (media?.media_type === "image" && media.url) {
      return `
        <button
          type="button"
          class="explore-tile vybe-photo-trigger"
          data-vybe-photo
          data-photo-url="${escapeHtml(media.url)}"
          data-photo-alt="${escapeHtml(displayName)} post"
          data-explore-username="${escapeHtml(username)}"
        >
          <img
            src="${escapeHtml(media.url)}"
            alt="${escapeHtml(displayName)} post"
            loading="lazy"
            decoding="async"
            onerror="this.closest('.explore-tile').classList.add('explore-media-error')"
          />

          <span class="explore-tile-overlay">
            <span>
              ${escapeHtml(displayName)}
            </span>
          </span>
        </button>
      `;
    }

    if (media?.media_type === "video" && media.url) {
      return `
        <div
          class="explore-tile explore-video-tile"
          data-explore-username="${escapeHtml(username)}"
        >
          ${renderVYBEVideoPlayer(media, { compact: true })}

          <span class="explore-tile-overlay">
            <span>
              ${escapeHtml(displayName)}
            </span>
          </span>
        </div>
      `;
    }

    const text =
      String(post.content || "").trim();

    const preview =
      text.length > 90
        ? `${text.slice(0, 90)}…`
        : text;

    return `
      <button
        type="button"
        class="explore-tile explore-text-tile"
        data-explore-username="${escapeHtml(username)}"
      >
        <span class="explore-text-icon">✦</span>

        <span class="explore-text-content">
          ${escapeHtml(preview || "VYBE")}
        </span>

        <span class="explore-text-author">
          @${escapeHtml(username)}
        </span>
      </button>
    `;
  }).join("");

  initVYBEVideoPlayers(grid);

  grid
    .querySelectorAll("[data-explore-username]")
    .forEach(tile => {
      tile.addEventListener("click", event => {
        if (
          event.target.closest(
            "[data-vybe-video]"
          )
        ) {
          return;
        }

        if (
          event.target.closest(
            "[data-vybe-photo]"
          )
        ) {
          return;
        }

        const username =
          tile.dataset.exploreUsername;

        if (username) {
          showPublicProfile(username);
        }
      });
    });
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
      return vybeIcon("like");
    case "reaction":
      return vybeIcon("like", true);
    case "comment":
      return vybeIcon("comment");
    case "repost":
      return vybeIcon("repost");
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
        <div class="activity-empty-icon">${vybeIcon("like")}</div>
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
  hideDynamicScreens();
  show(bottomNav);
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
  .querySelector("#notificationsButton")
  ?.addEventListener("click", event => {
    event.preventDefault();
    showActivity();
  });

if (state.authenticated) {
  loadActivityNotifications();
}

/* VYBE post media picker wiring */
(() => {
  const input = document.getElementById("postMediaInput");
  const preview = document.getElementById("postMediaPreview");

  if (!input) return;

  input.addEventListener("change", handlePostMediaSelection);

  if (preview) {
    preview.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-remove-media-index]"
      );

      if (!button) return;

      const index = Number(
        button.dataset.removeMediaIndex
      );

      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < state.createPostMedia.length
      ) {
        state.createPostMedia.splice(index, 1);
        renderPostMediaPreview();
      }
    });
  }
})();

/* VYBE story controls */
(() => {
  const addStoryButton = document.getElementById("addStoryButton");
  const closeButton = document.getElementById("closeCreateStory");
  const form = document.getElementById("createStoryForm");
  const input = document.getElementById("storyMediaInput");
  const closeViewer = document.getElementById("closeStoryViewer");
  const left = document.getElementById("storyTapLeft");
  const right = document.getElementById("storyTapRight");
  const feed = document.getElementById("storiesFeed");
  const viewer = document.getElementById("storyViewer");
  const likeButton = document.getElementById("storyLikeButton");
  const reactionPicker = document.getElementById("storyReactionPicker");
  const deleteButton = document.getElementById("storyDeleteButton");

  addStoryButton?.addEventListener("click", openCreateStory);

  document.getElementById("topCreateButton")?.addEventListener("click", () => {
    openCreatePost();
  });
  closeButton?.addEventListener("click", closeCreateStory);
  form?.addEventListener("submit", createStory);
  input?.addEventListener("change", handleStoryMediaSelection);
  closeViewer?.addEventListener("click", closeStoryViewer);

  left?.addEventListener("click", showPreviousStory);
  right?.addEventListener("click", showNextStory);

  feed?.addEventListener("click", event => {
    const card = event.target.closest("[data-story-user]");

    if (card) {
      openStoryByUser(card.dataset.storyUser);
      return;
    }

    if (event.target.closest("#emptyAddStory")) {
      openCreateStory();
    }
  });

  viewer?.addEventListener("pointerdown", event => {
    storyHoldStart = Date.now();
    storyTouchStartX = event.clientX;
    storyTouchStartY = event.clientY;
    pauseStory();
  });

  viewer?.addEventListener("pointerup", event => {
    const dx = event.clientX - storyTouchStartX;
    const dy = event.clientY - storyTouchStartY;

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        showNextStory();
      } else {
        showPreviousStory();
      }
      return;
    }

    resumeStory();
  });

  viewer?.addEventListener("pointercancel", resumeStory);

  likeButton?.addEventListener("click", async () => {
    const story = state.stories[state.activeStoryIndex];
    if (!story) return;

    const reaction = story.viewer_reaction === "❤️"
      ? null
      : "❤️";

    try {
      if (reaction) {
        await api(`/api/stories/${story.id}/reaction`, {
          method: "POST",
          body: JSON.stringify({ reaction })
        });
      }

      story.viewer_reaction = reaction;
      likeButton.innerHTML = vybeIcon("like", Boolean(reaction));
    } catch (error) {
      console.error(error);
    }
  });

  let heartHoldTimer = null;

  likeButton?.addEventListener("pointerdown", event => {
    event.stopPropagation();

    heartHoldTimer = setTimeout(() => {
      reactionPicker?.classList.remove("hidden");
    }, 500);
  });

  likeButton?.addEventListener("pointerup", event => {
    event.stopPropagation();

    if (heartHoldTimer) {
      clearTimeout(heartHoldTimer);
      heartHoldTimer = null;
    }
  });

  likeButton?.addEventListener("pointercancel", () => {
    clearTimeout(heartHoldTimer);
    heartHoldTimer = null;
  });

  document.querySelectorAll("[data-reaction]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();

      const story = state.stories[state.activeStoryIndex];
      if (!story) return;

      try {
        await api(`/api/stories/${story.id}/reaction`, {
          method: "POST",
          body: JSON.stringify({
            reaction: button.dataset.reaction
          })
        });

        story.viewer_reaction = button.dataset.reaction;

        if (likeButton) {
          likeButton.textContent = button.dataset.reaction;
        }

        reactionPicker?.classList.add("hidden");
      } catch (error) {
        console.error(error);
      }
    });
  });

  deleteButton?.addEventListener("click", async event => {
    event.stopPropagation();

    const story = state.stories[state.activeStoryIndex];

    if (
      !story ||
      String(story.user_id) !== String(state.user?.id)
    ) {
      return;
    }

    if (!confirm("Delete this story?")) return;

    try {
      await api(`/api/stories/${story.id}`, {
        method: "DELETE"
      });

      closeStoryViewer();
      await loadStories();
    } catch (error) {
      alert(error.message || "Could not delete story");
    }
  });

  document.getElementById("storyReplyButton")?.addEventListener(
    "click",
    () => {
      const story = state.stories[state.activeStoryIndex];
      if (!story) return;

      const message = prompt("Reply to this story:");

      if (!message?.trim()) return;

      alert("DM reply will be connected to Messages in the next step.");
    }
  );

  document.getElementById("storyShareButton")?.addEventListener(
    "click",
    async () => {
      const story = state.stories[state.activeStoryIndex];
      if (!story) return;

      const shareData = {
        title: "VYBE Story",
        text: story.caption || "Check out this VYBE story",
        url: `${location.origin}/?story=${encodeURIComponent(story.id)}`
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
          alert("Story link copied.");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      }
    }
  );
})();

/* --------------------------------
   PROFILE CREATE POST
-------------------------------- */

document
  .getElementById("profileCreatePostButton")
  ?.addEventListener("click", openCreatePost);



/* --------------------------------
   VYBE MEDIA SYSTEM
-------------------------------- */

let vybeActiveVideo = null;
let vybeVideoObserver = null;
let vybePhotoViewer = null;

function renderVYBEVideoPlayer(media, options = {}) {
  const url = escapeHtml(media?.url || "");
  if (!url) return "";

  const poster = media?.poster_url
    ? ` poster="${escapeHtml(media.poster_url)}"`
    : "";

  const compact = options.compact ? " vybe-video-compact" : "";

  return `
    <div
      class="vybe-video-player${compact}"
      data-vybe-video
      data-video-url="${url}"
    >
      <video
        class="vybe-video-element"
        src="${url}"
        ${poster}
        muted
        playsinline
        preload="metadata"
        aria-label="VYBE video"
      ></video>

      <button
        type="button"
        class="vybe-video-play"
        data-vybe-video-play
        aria-label="Play video"
      >
        ▶
      </button>

      <div class="vybe-video-top-controls">
        <button
          type="button"
          class="vybe-video-control"
          data-vybe-video-mute
          aria-label="Unmute video"
        >🔇</button>
      </div>

      <div class="vybe-video-bottom-controls">
        <span class="vybe-video-time" data-vybe-video-time>0:00</span>

        <input
          class="vybe-video-progress"
          data-vybe-video-progress
          type="range"
          min="0"
          max="100"
          value="0"
          step="0.1"
          aria-label="Video progress"
        />

        <button
          type="button"
          class="vybe-video-control"
          data-vybe-video-fullscreen
          aria-label="Fullscreen"
        >⛶</button>
      </div>
    </div>
  `;
}

function renderVYBEPostMedia(mediaItems, options = {}) {
  if (!Array.isArray(mediaItems) || !mediaItems.length) {
    return "";
  }

  const items = mediaItems.slice(0, 4);

  const layout =
    items.length === 1 ? "single" :
    items.length === 2 ? "two" :
    items.length === 3 ? "three" :
    "four";

  return `
    <div class="post-media ${layout}" data-vybe-media-group>
      ${items.map((media, index) => {
        const url = escapeHtml(media?.url || "");

        if (!url) return "";

        if (media.media_type === "video") {
          return `
            <div
              class="post-media-item vybe-home-video"
              data-vybe-open-video="${escapeHtml(options.postId || "")}"
            >
              ${renderVYBEVideoPlayer(media)}
            </div>
          `;
        }

        if (media.media_type === "image") {
          return `
            <button
              type="button"
              class="vybe-photo-trigger post-media-item"
              data-vybe-photo
              data-photo-index="${index}"
              data-photo-url="${url}"
              data-photo-alt="Post image"
            >
              <img
                src="${url}"
                alt="Post image"
                loading="lazy"
                decoding="async"
                onerror="this.closest('.post-media-item').classList.add('media-load-error')"
              />
            </button>
          `;
        }

        return "";
      }).join("")}
    </div>
  `;
}

function initVYBEVideoPlayers(root = document) {
  const players = root.querySelectorAll
    ? root.querySelectorAll("[data-vybe-video]")
    : [];

  if (!players.length) return;

  if (!vybeVideoObserver) {
    vybeVideoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const player = entry.target;
        const video = player.querySelector(".vybe-video-element");

        if (!video) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (vybeActiveVideo && vybeActiveVideo !== video) {
            vybeActiveVideo.pause();
          }

          vybeActiveVideo = video;

          video.play().catch(() => {});

          player.classList.add("is-playing");
        } else {
          if (!video.paused) {
            video.pause();
          }

          player.classList.remove("is-playing");
        }
      });
    }, {
      threshold: [0, 0.6, 1]
    });
  }

  players.forEach(player => {
    if (player.dataset.vybeVideoReady === "true") return;

    player.dataset.vybeVideoReady = "true";

    const video =
      player.querySelector(".vybe-video-element");

    if (!video) return;

    vybeVideoObserver.observe(player);

    video.addEventListener("play", () => {
      if (
        vybeActiveVideo &&
        vybeActiveVideo !== video
      ) {
        vybeActiveVideo.pause();
      }

      vybeActiveVideo = video;
      player.classList.add("is-playing");
    });

    video.addEventListener("pause", () => {
      player.classList.remove("is-playing");
    });

    video.addEventListener("timeupdate", () => {
      updateVYBEVideoUI(player);
    });

    video.addEventListener("loadedmetadata", () => {
      updateVYBEVideoUI(player);
    });

    video.addEventListener("ended", () => {
      player.classList.remove("is-playing");
      updateVYBEVideoUI(player);
    });
  });
}

function updateVYBEVideoUI(player) {
  const video =
    player.querySelector(".vybe-video-element");

  const progress =
    player.querySelector("[data-vybe-video-progress]");

  const time =
    player.querySelector("[data-vybe-video-time]");

  if (!video) return;

  if (
    progress &&
    Number.isFinite(video.duration) &&
    video.duration > 0
  ) {
    progress.value =
      (video.currentTime / video.duration) * 100;
  }

  if (time) {
    const current =
      Math.floor(video.currentTime || 0);

    const minutes =
      Math.floor(current / 60);

    const seconds =
      String(current % 60).padStart(2, "0");

    time.textContent =
      `${minutes}:${seconds}`;
  }
}

function toggleVYBEVideo(video) {
  if (!video) return;

  if (video.paused) {
    if (
      vybeActiveVideo &&
      vybeActiveVideo !== video
    ) {
      vybeActiveVideo.pause();
    }

    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function openVYBEPhotoViewer(items, startIndex = 0) {
  const photos = (Array.isArray(items) ? items : [])
    .filter(item => item?.url);

  if (!photos.length) return;

  let index = Math.max(
    0,
    Math.min(startIndex, photos.length - 1)
  );

  if (!vybePhotoViewer) {
    vybePhotoViewer =
      document.createElement("div");

    vybePhotoViewer.className =
      "vybe-photo-viewer hidden";

    vybePhotoViewer.innerHTML = `
      <div class="vybe-photo-viewer-backdrop"></div>

      <button
        type="button"
        class="vybe-photo-close"
        data-vybe-photo-close
        aria-label="Close photo"
      >×</button>

      <button
        type="button"
        class="vybe-photo-nav vybe-photo-prev"
        data-vybe-photo-prev
        aria-label="Previous photo"
      >‹</button>

      <div
        class="vybe-photo-stage"
        data-vybe-photo-stage
      ></div>

      <button
        type="button"
        class="vybe-photo-nav vybe-photo-next"
        data-vybe-photo-next
        aria-label="Next photo"
      >›</button>

      <div
        class="vybe-photo-counter"
        data-vybe-photo-counter
      ></div>
    `;

    document.body.appendChild(vybePhotoViewer);

    vybePhotoViewer
      .querySelector("[data-vybe-photo-close]")
      ?.addEventListener("click", closeVYBEPhotoViewer);

    vybePhotoViewer
      .querySelector(".vybe-photo-viewer-backdrop")
      ?.addEventListener("click", closeVYBEPhotoViewer);

    vybePhotoViewer
      .querySelector("[data-vybe-photo-prev]")
      ?.addEventListener("click", () => {
        index =
          (index - 1 + photos.length) %
          photos.length;

        renderVYBEPhotoViewer();
      });

    vybePhotoViewer
      .querySelector("[data-vybe-photo-next]")
      ?.addEventListener("click", () => {
        index =
          (index + 1) %
          photos.length;

        renderVYBEPhotoViewer();
      });
  }

  function renderVYBEPhotoViewer() {
    const stage =
      vybePhotoViewer.querySelector(
        "[data-vybe-photo-stage]"
      );

    const counter =
      vybePhotoViewer.querySelector(
        "[data-vybe-photo-counter]"
      );

    const item = photos[index];

    stage.innerHTML = `
      <img
        class="vybe-photo-viewer-image"
        src="${escapeHtml(item.url)}"
        alt="${escapeHtml(item.alt || "VYBE photo")}"
        draggable="false"
      />
    `;

    if (counter) {
      counter.textContent =
        `${index + 1} / ${photos.length}`;
    }

    vybePhotoViewer
      .querySelector("[data-vybe-photo-prev]")
      ?.classList.toggle(
        "hidden",
        photos.length <= 1
      );

    vybePhotoViewer
      .querySelector("[data-vybe-photo-next]")
      ?.classList.toggle(
        "hidden",
        photos.length <= 1
      );

    const image =
      stage.querySelector("img");

    if (image) {
      let scale = 1;
      let startDistance = 0;

      image.addEventListener("wheel", event => {
        event.preventDefault();

        scale += event.deltaY < 0
          ? 0.15
          : -0.15;

        scale =
          Math.max(1, Math.min(4, scale));

        image.style.transform =
          `scale(${scale})`;
      }, { passive: false });

      let touchStartX = 0;

      image.addEventListener("touchstart", event => {
        if (event.touches.length === 1) {
          touchStartX =
            event.touches[0].clientX;
        }

        if (event.touches.length === 2) {
          startDistance =
            Math.hypot(
              event.touches[0].clientX -
                event.touches[1].clientX,
              event.touches[0].clientY -
                event.touches[1].clientY
            );
        }
      }, { passive: true });

      image.addEventListener("touchend", event => {
        if (
          event.changedTouches.length === 1 &&
          startDistance === 0
        ) {
          const delta =
            event.changedTouches[0].clientX -
            touchStartX;

          if (Math.abs(delta) > 60) {
            index =
              delta < 0
                ? (index + 1) % photos.length
                : (index - 1 + photos.length) %
                  photos.length;

            renderVYBEPhotoViewer();
          }
        }

        startDistance = 0;
      }, { passive: true });
    }
  }

  renderVYBEPhotoViewer();

  vybePhotoViewer.classList.remove("hidden");
  document.body.classList.add("vybe-media-viewer-open");
}

function closeVYBEPhotoViewer() {
  if (!vybePhotoViewer) return;

  vybePhotoViewer.classList.add("hidden");
  document.body.classList.remove("vybe-media-viewer-open");
}

document.addEventListener("click", event => {
  const play =
    event.target.closest("[data-vybe-video-play]");

  if (play) {
    event.preventDefault();
    event.stopPropagation();

    const player =
      play.closest("[data-vybe-video]");

    toggleVYBEVideo(
      player?.querySelector(".vybe-video-element")
    );

    return;
  }

  const mute =
    event.target.closest("[data-vybe-video-mute]");

  if (mute) {
    event.preventDefault();
    event.stopPropagation();

    const player =
      mute.closest("[data-vybe-video]");

    const video =
      player?.querySelector(".vybe-video-element");

    if (video) {
      video.muted = !video.muted;
      mute.textContent =
        video.muted ? "🔇" : "🔊";
    }

    return;
  }

  const fullscreen =
    event.target.closest(
      "[data-vybe-video-fullscreen]"
    );

  if (fullscreen) {
    event.preventDefault();
    event.stopPropagation();

    const player =
      fullscreen.closest("[data-vybe-video]");

    if (player?.requestFullscreen) {
      player.requestFullscreen().catch(() => {});
    }

    return;
  }

  const photo =
    event.target.closest("[data-vybe-photo]");

  if (photo) {
    event.preventDefault();

    const group =
      photo.closest("[data-vybe-media-group]");

    const photoButtons =
      group
        ? Array.from(
            group.querySelectorAll(
              "[data-vybe-photo]"
            )
          )
        : [photo];

    const items = photoButtons.map(item => ({
      url: item.dataset.photoUrl,
      alt: item.dataset.photoAlt || "VYBE photo"
    }));

    const startIndex =
      photoButtons.indexOf(photo);

    openVYBEPhotoViewer(
      items,
      Math.max(0, startIndex)
    );

    return;
  }
});

document.addEventListener("input", event => {
  const progress =
    event.target.closest(
      "[data-vybe-video-progress]"
    );

  if (!progress) return;

  const player =
    progress.closest("[data-vybe-video]");

  const video =
    player?.querySelector(".vybe-video-element");

  if (
    video &&
    Number.isFinite(video.duration) &&
    video.duration > 0
  ) {
    video.currentTime =
      (Number(progress.value) / 100) *
      video.duration;
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    vybePhotoViewer &&
    !vybePhotoViewer.classList.contains("hidden")
  ) {
    closeVYBEPhotoViewer();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initVYBEVideoPlayers();
});

/* --------------------------------
   VYBZ / DM NAVIGATION
-------------------------------- */

function showVybz(postId = null) {
  hideDynamicScreens();

  show(bottomNav);

  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  let screen = document.getElementById("vybzScreen");

  if (!screen) {
    screen = document.createElement("section");
    screen.id = "vybzScreen";
    screen.className = "screen vybz-screen";

    screen.innerHTML = `
      <header class="vybz-topbar">
        <div class="vybz-tabs">
          <button type="button" class="vybz-tab active">VYBZ ▾</button>
          <button type="button" class="vybz-tab">Friends</button>
          <button type="button" class="vybz-tab">Following</button>
        </div>
      </header>

      <main class="vybz-feed" id="vybzFeed"></main>
    `;

    document.body.appendChild(screen);

  }

  screen.classList.remove("hidden");
  setActiveNav("vybz");

  const feed = screen.querySelector("#vybzFeed");

  if (!feed) return;

  const posts = Array.isArray(state.posts)
    ? state.posts
    : [];

  const videoPosts = posts.filter(post =>
    Array.isArray(post.media) &&
    post.media.some(media =>
      media?.media_type === "video" &&
      media?.url
    )
  );

  if (!videoPosts.length) {
    feed.innerHTML = `
      <div class="vybz-empty">
        <div class="vybz-empty-icon">${vybeIcon("vybz")}</div>
        <h2>No VYBZ yet</h2>
        <p>Video posts will appear here.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = videoPosts.map(post => {
    const media = post.media.find(item =>
      item?.media_type === "video" &&
      item?.url
    );

    const name =
      post.display_name ||
      post.username ||
      "VYBER";

    const isMine =
      state.user &&
      state.user.id === post.user_id;

    const likes =
      Number(post.reaction_count || 0);

    const reposts =
      Number(post.repost_count || 0);

    const saves =
      Number(post.save_count || 0);

    const liked =
      post.viewer_reaction === "like";

    const reposted =
      Boolean(post.viewer_reposted);

    const saved =
      Boolean(post.viewer_saved);

    return `
      <article
        class="vybz-item"
        data-post-id="${escapeHtml(post.id)}"
        data-vybz-post="${escapeHtml(post.id)}"
        data-viewer-reaction="${escapeHtml(post.viewer_reaction || "")}"
        data-viewer-reposted="${reposted}"
        data-repost-count="${reposts}"
        data-viewer-saved="${saved}"
        data-save-count="${saves}"
      >

        <div class="vybz-media">
          ${renderVYBEVideoPlayer(media)}
        </div>

        <div class="vybz-overlay">

          <div class="vybz-author">
            <button
              type="button"
              class="vybz-avatar"
              data-vybz-profile="${escapeHtml(post.username)}"
            >
              ${escapeHtml(name.charAt(0).toUpperCase())}
            </button>

            <button
              type="button"
              class="vybz-username"
              data-vybz-profile="${escapeHtml(post.username)}"
            >
              @${escapeHtml(post.username)}
            </button>

            ${
              !isMine
                ? `
                  <button
                    type="button"
                    class="vybz-follow"
                    data-vybe-follow="${escapeHtml(post.username)}"
                  >
                    Follow
                  </button>
                `
                : ""
            }
          </div>

          <div class="vybz-caption">
            ${escapeHtml(post.content || "")}
            ${
              post.content && post.content.length > 90
                ? `<button type="button" class="vybz-see-more">See more</button>`
                : ""
            }
          </div>

        </div>

        <div class="vybz-actions">

          <button
            type="button"
            class="vybz-action ${liked ? "action-active" : ""}"
            data-vybe-like="${escapeHtml(post.id)}"
            aria-label="Like"
            aria-pressed="${liked}"
          >
            <span>${vybeIcon("like", liked)}</span>
            <small>${formatVYBECount(likes)}</small>
          </button>

          <button
            type="button"
            class="vybz-action"
            data-vybe-comment="${escapeHtml(post.id)}"
            aria-label="Comments"
          >
            ${vybeIcon("comment")}
            <small>0</small>
          </button>

          <button
            type="button"
            class="vybz-action ${reposted ? "action-active" : ""}"
            data-vybe-repost="${escapeHtml(post.id)}"
            aria-label="Repost"
            aria-pressed="${reposted}"
          >
            ${vybeIcon("repost", Boolean(post.viewer_reposted))}
            <small>${formatVYBECount(reposts)}</small>
          </button>

          <button
            type="button"
            class="vybz-action"
            data-vybe-share="${escapeHtml(post.id)}"
            aria-label="Share"
          >
            ${vybeIcon("share")}
            <small>Share</small>
          </button>

          <button
            type="button"
            class="vybz-action ${saved ? "action-active" : ""}"
            data-vybe-save="${escapeHtml(post.id)}"
            aria-label="Save"
            aria-pressed="${saved}"
          >
            <span>${vybeIcon("save", saved)}</span>
            <small>${formatVYBECount(saves)}</small>
          </button>

        </div>
      </article>
    `;
  }).join("");

  initVYBEVideoPlayers(feed);

  feed.querySelectorAll(".vybe-video-element").forEach(video => {
    video.muted = false;
    video.volume = 1;
  });

  /* VYBZ videos must always have sound. */
  feed.querySelectorAll(".vybe-video-element").forEach(video => {
    video.muted = false;
    video.volume = 1;

    video.addEventListener("loadedmetadata", () => {
      video.muted = false;
      video.volume = 1;
    });

    video.play().catch(() => {});
  });

  /* Remove mute controls from VYBZ. */
  feed
    .querySelectorAll("[data-vybe-video-mute]")
    .forEach(button => {
      button.remove();
    });

  setupVYBEPostActions(feed);

  feed.querySelectorAll("[data-vybe-like]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleVYBZLike(button.dataset.vybeLike);
    });
  });

  feed.querySelectorAll("[data-vybe-save]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleVYBZSave(button.dataset.vybeSave);
    });
  });

  feed.querySelectorAll("[data-vybe-comment]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const postId = button.dataset.vybeComment;

      openComments(postId);
      loadVYBZCommentCount(
        postId,
        button.closest(".vybz-item")
      );
    });
  });

  feed.querySelectorAll(".vybz-item").forEach(item => {
    const postId = item.dataset.postId;

    if (postId) {
      loadVYBZCommentCount(postId, item);
    }
  });

  feed.querySelectorAll("[data-vybe-share]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      const postId = button.dataset.vybeShare;

      try {
        const url =
          `${location.origin}${location.pathname}?post=${encodeURIComponent(postId)}`;

        if (navigator.share) {
          await navigator.share({
            title: "VYBE",
            text: "Check this VYBZ on VYBE",
            url
          });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          button.querySelector("small").textContent = "Copied";
          setTimeout(() => {
            if (button.querySelector("small")) {
              button.querySelector("small").textContent = "Share";
            }
          }, 1200);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("VYBZ share error:", error);
        }
      }
    });
  });

  feed.querySelectorAll("[data-vybe-repost]").forEach(button => {
    if (button.dataset.vybeReady === "true") return;

    button.dataset.vybeReady = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      toggleVYBZRepost(button.dataset.vybeRepost);
    });
  });

  feed.querySelectorAll("[data-vybz-profile]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const username = button.dataset.vybzProfile;

      if (username) {
        showPublicProfile(username);
      }
    });
  });

  feed.querySelectorAll(".vybz-see-more").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      button
        .closest(".vybz-caption")
        ?.classList.toggle("expanded");
    });
  });

  /* Keep the selected VYBZ item in view. */
  const targetIndex = postId
    ? videoPosts.findIndex(
        post => String(post.id) === String(postId)
      )
    : 0;

  if (targetIndex >= 0) {
    const target = feed.children[targetIndex];

    target?.scrollIntoView({
      behavior: "instant",
      block: "start"
    });

    const video =
      target?.querySelector(".vybe-video-element");

    if (video) {
      video.muted = false;
      video.volume = 1;
      video.play().catch(() => {});
    }
  }
}


function vybeIcon(name, active = false) {
  const paths = {
    like: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M20.8 8.7c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A5.2 5.2 0 0 1 12 5.9a5.2 5.2 0 0 1 8.8 2.8Z"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M4 5.5h16v10.8H9l-5 3v-13.8Z"/><path class="vybe-icon-detail" d="M8 10h8M8 13h5"/></svg>`,
    repost: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M7 7h10l-2.7-2.7"/><path class="vybe-icon-main" d="M17 17H7l2.7 2.7"/><path class="vybe-icon-main" d="M17 7a5 5 0 0 1 3 4.5"/><path class="vybe-icon-main" d="M7 17a5 5 0 0 1-3-4.5"/></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vybe-icon-node" cx="18" cy="5.5" r="2.3"/><circle class="vybe-icon-node" cx="6" cy="12" r="2.3"/><circle class="vybe-icon-node" cx="18" cy="18.5" r="2.3"/><path class="vybe-icon-main" d="m8 11 7.7-4.2M8 13l7.7 4.2"/></svg>`,
    save: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M6 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21z"/></svg>`,
    follow: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vybe-icon-main" cx="9" cy="8" r="3"/><path class="vybe-icon-main" d="M3.8 19c.6-3 2.3-4.6 5.2-4.6s4.6 1.6 5.2 4.6"/><path class="vybe-icon-main" d="M18 11v6M15 14h6"/></svg>`,
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M3.5 10.8 12 3.7l8.5 7.1v8.7a1 1 0 0 1-1 1h-5.1v-5.7H9.6v5.7H4.5a1 1 0 0 1-1-1z"/></svg>`,
    vybz: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M7 4.8 19 12 7 19.2z"/><path class="vybe-icon-detail" d="M4.5 7.2v9.6"/></svg>`,
    dm: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="vybe-icon-main" d="M4 5.5h16v11H9l-5 3z"/><path class="vybe-icon-detail" d="m8 10 4 3 4-3"/></svg>`,
    explore: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vybe-icon-main" cx="11" cy="11" r="6.7"/><path class="vybe-icon-main" d="m16 16 4.5 4.5"/><path class="vybe-icon-detail" d="m13.8 8.2-1.2 3-3 1.2 3 1.2 1.2 3 1.2-3 3-1.2-3-1.2z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="vybe-icon-main" cx="12" cy="8" r="3.4"/><path class="vybe-icon-main" d="M5.2 20c.8-3.5 3.2-5.3 6.8-5.3s6 1.8 6.8 5.3"/></svg>`
  };

  const icon = paths[name] || "";
  return `<span class="vybe-svg-icon${active ? " is-active" : ""}">${icon}</span>`;
}

function formatVYBECount(value) {
  const n = Number(value) || 0;

  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  }

  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K`;
  }

  return String(n);
}

async function toggleVYBZLike(postId) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to like posts.");
    return;
  }

  const item = document.querySelector(
    `.vybz-item[data-post-id="${CSS.escape(postId)}"]`
  );

  if (!item) return;

  const button = item.querySelector(
    `[data-vybe-like="${CSS.escape(postId)}"]`
  );

  if (button) button.disabled = true;

  try {
    const current =
      item.dataset.viewerReaction || "";

    const data =
      current === "like"
        ? await api(
            `/api/posts/${encodeURIComponent(postId)}/reaction`,
            { method: "DELETE" }
          )
        : await api(
            `/api/posts/${encodeURIComponent(postId)}/reaction`,
            {
              method: "PUT",
              body: JSON.stringify({ reaction: "like" })
            }
          );

    if (!data.success) {
      throw new Error(
        data.error || "Could not update like."
      );
    }

    const liked =
      current !== "like";

    item.dataset.viewerReaction =
      liked ? "like" : "";

    const count =
      Number(
        data.reaction_counts?.like || 0
      );

    if (button) {
      button.classList.toggle(
        "action-active",
        liked
      );

      button.setAttribute(
        "aria-pressed",
        liked ? "true" : "false"
      );

      button.innerHTML = `
        <span>${vybeIcon("like", liked)}</span>
        <small>${formatVYBECount(count)}</small>
      `;
    }

  } catch (error) {
    console.error("VYBZ like error:", error);
    alert(
      error.message ||
      "Could not update like."
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function toggleVYBZSave(postId) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to save posts.");
    return;
  }

  const item = document.querySelector(
    `.vybz-item[data-post-id="${CSS.escape(postId)}"]`
  );

  if (!item) return;

  const button = item.querySelector(
    `[data-vybe-save="${CSS.escape(postId)}"]`
  );

  const saved =
    item.dataset.viewerSaved === "true";

  if (button) button.disabled = true;

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/save`,
      {
        method: saved ? "DELETE" : "PUT"
      }
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not update save."
      );
    }

    const isSaved = Boolean(data.saved);
    const count = Number(data.save_count) || 0;

    item.dataset.viewerSaved =
      isSaved ? "true" : "false";

    if (button) {
      button.classList.toggle(
        "action-active",
        isSaved
      );

      button.setAttribute(
        "aria-pressed",
        isSaved ? "true" : "false"
      );

      button.innerHTML = `
        ${vybeIcon("save", Boolean(post.viewer_saved))}
        <small>${formatVYBECount(count)}</small>
      `;
    }

  } catch (error) {
    console.error("VYBZ save error:", error);
    alert(
      error.message ||
      "Could not update save."
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadVYBZCommentCount(postId, item) {
  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/comments`
    );

    if (!data.success) return;

    const count =
      (data.comments || []).length;

    const button = item.querySelector(
      `[data-vybe-comment="${CSS.escape(postId)}"]`
    );

    const countElement =
      button?.querySelector("small");

    if (countElement) {
      countElement.textContent =
        formatVYBECount(count);
    }
  } catch (error) {
    console.error(
      "VYBZ comment count error:",
      error
    );
  }
}

async function toggleVYBZRepost(postId) {
  if (!state.authenticated || !state.user) {
    alert("Please log in to repost posts.");
    return;
  }

  const item = document.querySelector(
    `.vybz-item[data-post-id="${CSS.escape(postId)}"]`
  );

  if (!item) return;

  const button = item.querySelector(
    `[data-vybe-repost="${CSS.escape(postId)}"]`
  );

  const alreadyReposted =
    item.dataset.viewerReposted === "true";

  if (button) button.disabled = true;

  try {
    const data = await api(
      `/api/posts/${encodeURIComponent(postId)}/repost`,
      {
        method: alreadyReposted ? "DELETE" : "PUT"
      }
    );

    if (!data.success) {
      throw new Error(
        data.error || "Could not update repost."
      );
    }

    const reposted = Boolean(data.reposted);
    const count = Number(data.repost_count) || 0;

    item.dataset.viewerReposted =
      reposted ? "true" : "false";

    item.dataset.repostCount = String(count);

    if (button) {
      button.classList.toggle(
        "action-active",
        reposted
      );

      button.setAttribute(
        "aria-pressed",
        reposted ? "true" : "false"
      );

      button.innerHTML = `
        ${vybeIcon("repost", Boolean(post.viewer_reposted))}
        <small>${formatVYBECount(count)}</small>
      `;
    }
  } catch (error) {
    console.error("VYBZ repost error:", error);

    alert(
      error.message ||
      "Could not update repost."
    );
  } finally {
    if (button) button.disabled = false;
  }
}

let activeDMConversation = null;
let dmConversations = [];
let dmSocket = null;

function initDMSocket() {
  if (dmSocket || typeof window.io !== "function") return;
  if (!state.user?.id) return;

  dmSocket = window.io({
    withCredentials: true
  });

  dmSocket.on("connect", () => {
    console.log("[VYBE DM] realtime connected");

    if (activeDMConversation) {
      dmSocket.emit(
        "join_conversation",
        activeDMConversation
      );
    }
  });

  dmSocket.on("connect_error", error => {
    console.error(
      "[VYBE DM] realtime connection error:",
      error?.message || error
    );
  });

  dmSocket.on("dm:message", message => {
    if (!message?.id || !message?.conversation_id) {
      return;
    }

    const screen =
      document.getElementById("dmScreen");

    if (
      screen &&
      !screen.classList.contains("hidden") &&
      String(activeDMConversation) ===
        String(message.conversation_id)
    ) {
      appendDMMessage(screen, message);
    }
  });
}

function appendDMMessage(screen, message) {
  const container =
    screen?.querySelector("#dmMessages");

  if (!container || !message?.id) return;

  const messageId = String(message.id);

  if (
    container.querySelector(
      `[data-dm-message-id="${CSS.escape(messageId)}"]`
    )
  ) {
    return;
  }

  const empty =
    container.querySelector(".dm-chat-empty");

  if (empty) empty.remove();

  const mine =
    String(message.sender_id) ===
    String(state.user?.id);

  const row =
    document.createElement("div");

  row.className =
    `dm-message-row ${mine ? "is-mine" : "is-theirs"}`;

  row.dataset.dmMessageId = messageId;

  row.innerHTML = `
    <div class="dm-message-bubble">
      <div class="dm-message-content">
        ${escapeHtml(message.content || "")}
      </div>
      <time>${escapeHtml(
        formatDMTime(message.created_at)
      )}</time>
    </div>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}


function dmInitial(name) {
  return String(name || "V")
    .trim()
    .charAt(0)
    .toUpperCase() || "V";
}

function dmAvatar(user, className = "dm-avatar") {
  const name = user?.display_name || user?.username || "VYBE";

  if (user?.avatar_url) {
    return `
      <span class="${className}">
        <img
          src="${escapeHtml(user.avatar_url)}"
          alt="${escapeHtml(name)}"
        >
      </span>
    `;
  }

  return `
    <span class="${className}">
      ${escapeHtml(dmInitial(name))}
    </span>
  `;
}

function formatDMTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return "now";
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}m`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}h`;
  }

  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d`;
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
}

function renderDMHome(screen) {
  const conversations = dmConversations || [];

  screen.innerHTML = `
    <header class="dm-topbar">
      <div class="dm-topbar-title">
        <span class="dm-topbar-icon">
          ${vybeIcon("dm")}
        </span>
        <div>
          <strong>Messages</strong>
          <span>Private conversations</span>
        </div>
      </div>

      <button
        type="button"
        class="dm-new-button"
        id="dmNewMessageButton"
        aria-label="New message"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14"/>
          <path d="M5 12h14"/>
        </svg>
      </button>
    </header>

    <main class="dm-home-content">
      <div class="dm-search-wrap">
        <span class="dm-search-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8"/>
            <path d="m16 16 4.5 4.5"/>
          </svg>
        </span>

        <input
          id="dmSearchInput"
          class="dm-search-input"
          type="search"
          placeholder="Search messages"
          autocomplete="off"
        >
      </div>

      <div class="dm-section-heading">
        <span>Conversations</span>
        <button
          type="button"
          id="dmRefreshButton"
          class="dm-refresh-button"
        >
          Refresh
        </button>
      </div>

      <div id="dmConversationList" class="dm-conversation-list">
        ${
          conversations.length
            ? conversations.map(renderDMConversation).join("")
            : `
              <div class="dm-empty-state">
                <div class="dm-empty-icon">
                  ${vybeIcon("dm")}
                </div>
                <h2>No messages yet</h2>
                <p>Start a private conversation with someone on VYBE.</p>
                <button
                  type="button"
                  class="dm-start-button"
                  id="dmStartConversation"
                >
                  Start a conversation
                </button>
              </div>
            `
        }
      </div>
    </main>
  `;

  bindDMHomeEvents(screen);
}

function renderDMConversation(conversation) {
  const name =
    conversation.display_name ||
    conversation.username ||
    "VYBE";

  const unread = Number(conversation.unread_count || 0);

  return `
    <button
      type="button"
      class="dm-conversation"
      data-dm-conversation="${escapeHtml(conversation.id)}"
    >
      ${dmAvatar(conversation)}

      <span class="dm-conversation-body">
        <span class="dm-conversation-head">
          <strong>${escapeHtml(name)}</strong>
          <time>${escapeHtml(
            formatDMTime(
              conversation.last_message_at ||
              conversation.updated_at
            )
          )}</time>
        </span>

        <span class="dm-conversation-foot">
          <span class="dm-last-message">
            ${
              conversation.last_message
                ? escapeHtml(conversation.last_message)
                : "Start a conversation"
            }
          </span>

          ${
            unread > 0
              ? `<span class="dm-unread">${formatVYBECount(unread)}</span>`
              : ""
          }
        </span>
      </span>
    </button>
  `;
}

async function loadDMConversations(screen) {
  const list = screen.querySelector("#dmConversationList");

  if (list && !dmConversations.length) {
    list.innerHTML = `
      <div class="dm-loading">
        <span class="dm-loading-spinner"></span>
        <span>Loading messages...</span>
      </div>
    `;
  }

  try {
    const data = await api("/api/messages/conversations");

    dmConversations = data.conversations || [];
    renderDMHome(screen);
  } catch (error) {
    console.error("DM conversations error:", error);

    if (list) {
      list.innerHTML = `
        <div class="dm-empty-state dm-error-state">
          <div class="dm-empty-icon">
            ${vybeIcon("dm")}
          </div>
          <h2>Couldn't load messages</h2>
          <p>${escapeHtml(error.message || "Please try again.")}</p>
          <button
            type="button"
            class="dm-start-button"
            id="dmRetryButton"
          >
            Try again
          </button>
        </div>
      `;

      screen
        .querySelector("#dmRetryButton")
        ?.addEventListener("click", () => loadDMConversations(screen));
    }
  }
}

function bindDMHomeEvents(screen) {
  screen
    .querySelector("#dmNewMessageButton")
    ?.addEventListener("click", () => openDMUserSearch(screen));

  screen
    .querySelector("#dmStartConversation")
    ?.addEventListener("click", () => openDMUserSearch(screen));

  screen
    .querySelector("#dmRefreshButton")
    ?.addEventListener("click", () => loadDMConversations(screen));

  screen
    .querySelectorAll("[data-dm-conversation]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openDMChat(screen, button.dataset.dmConversation);
      });
    });

  screen
    .querySelector("#dmSearchInput")
    ?.addEventListener("input", event => {
      const term = event.target.value.trim().toLowerCase();

      screen.querySelectorAll("[data-dm-conversation]").forEach(item => {
        const conversation = dmConversations.find(
          c => String(c.id) === String(item.dataset.dmConversation)
        );

        const text = [
          conversation?.display_name,
          conversation?.username,
          conversation?.last_message
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        item.classList.toggle(
          "hidden",
          Boolean(term && !text.includes(term))
        );
      });
    });
}

async function openDMUserSearch(screen) {
  screen.innerHTML = `
    <header class="dm-topbar dm-search-topbar">
      <button
        type="button"
        class="dm-back-button"
        id="dmSearchBack"
        aria-label="Back"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 5-7 7 7 7"/>
        </svg>
      </button>

      <div class="dm-topbar-title">
        <div>
          <strong>New message</strong>
          <span>Find someone on VYBE</span>
        </div>
      </div>
    </header>

    <main class="dm-search-content">
      <div class="dm-search-wrap">
        <span class="dm-search-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8"/>
            <path d="m16 16 4.5 4.5"/>
          </svg>
        </span>

        <input
          id="dmUserSearchInput"
          class="dm-search-input"
          type="search"
          placeholder="Search people..."
          autocomplete="off"
          autofocus
        >
      </div>

      <div id="dmUserSearchResults" class="dm-user-results">
        <div class="dm-search-hint">
          Search by username or display name.
        </div>
      </div>
    </main>
  `;

  screen.querySelector("#dmSearchBack")?.addEventListener("click", () => {
    renderDMHome(screen);
    loadDMConversations(screen);
  });

  const input = screen.querySelector("#dmUserSearchInput");
  const results = screen.querySelector("#dmUserSearchResults");

  let timer = null;

  input?.addEventListener("input", () => {
    clearTimeout(timer);

    const term = input.value.trim();

    if (term.length < 2) {
      results.innerHTML = `
        <div class="dm-search-hint">
          Search by username or display name.
        </div>
      `;
      return;
    }

    results.innerHTML = `
      <div class="dm-loading">
        <span class="dm-loading-spinner"></span>
        <span>Searching...</span>
      </div>
    `;

    timer = setTimeout(async () => {
      try {
        const data = await api(
          `/api/search/users?q=${encodeURIComponent(term)}`
        );

        const users = (data.users || []).filter(
          user => String(user.id) !== String(state.user?.id)
        );

        if (!users.length) {
          results.innerHTML = `
            <div class="dm-search-hint">
              No people found for "${escapeHtml(term)}".
            </div>
          `;
          return;
        }

        results.innerHTML = users.map(user => `
          <button
            type="button"
            class="dm-user-result"
            data-dm-user-id="${escapeHtml(user.id)}"
          >
            ${dmAvatar(user)}

            <span class="dm-user-result-info">
              <strong>
                ${escapeHtml(
                  user.display_name ||
                  user.username ||
                  "VYBE"
                )}
                ${user.is_verified ? " ✓" : ""}
              </strong>
              <span>@${escapeHtml(user.username || "")}</span>
            </span>

            <svg class="dm-user-result-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7"/>
            </svg>
          </button>
        `).join("");

        results
          .querySelectorAll("[data-dm-user-id]")
          .forEach(button => {
            button.addEventListener("click", () => {
              startDMConversation(
                screen,
                button.dataset.dmUserId
              );
            });
          });
      } catch (error) {
        console.error("DM user search error:", error);

        results.innerHTML = `
          <div class="dm-search-hint">
            ${escapeHtml(error.message || "Search failed.")}
          </div>
        `;
      }
    }, 300);
  });

  requestAnimationFrame(() => input?.focus());
}

async function startDMConversation(screen, userId) {
  try {
    const data = await api("/api/messages/conversations", {
      method: "POST",
      body: JSON.stringify({ user_id: userId })
    });

    if (!data.success || !data.conversation?.id) {
      throw new Error(data.error || "Could not start conversation.");
    }

    await openDMChat(screen, data.conversation.id);
  } catch (error) {
    console.error("Start DM error:", error);
    alert(error.message || "Could not start conversation.");
  }
}

async function openDMChat(screen, conversationId) {
  screen.classList.add("dm-chat-mode");

  screen.innerHTML = `
    <header class="dm-chat-topbar">
      <button
        type="button"
        class="dm-back-button"
        id="dmChatBack"
        aria-label="Back to messages"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 5-7 7 7 7"/>
        </svg>
      </button>

      <div id="dmChatUser" class="dm-chat-user">
        <span class="dm-chat-avatar">V</span>
        <span>
          <strong>Loading...</strong>
          <small>Conversation</small>
        </span>
      </div>
    </header>

    <main id="dmMessages" class="dm-messages">
      <div class="dm-loading">
        <span class="dm-loading-spinner"></span>
        <span>Loading conversation...</span>
      </div>
    </main>

    <form id="dmComposer" class="dm-composer">
      <textarea
        id="dmMessageInput"
        rows="1"
        maxlength="5000"
        placeholder="Write a message..."
        autocomplete="off"
      ></textarea>

      <button
        type="submit"
        class="dm-send-button"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11.7 19.5 4.5 15 20 11.2 13.2 4 11.7Z"/>
          <path d="m11.2 13.2 8.3-8.1"/>
        </svg>
      </button>
    </form>
  `;

  if (activeDMConversation && dmSocket) {
    dmSocket.emit(
      "leave_conversation",
      activeDMConversation
    );
  }

  activeDMConversation = String(conversationId);

  if (dmSocket?.connected) {
    dmSocket.emit(
      "join_conversation",
      activeDMConversation
    );
  }

  screen.querySelector("#dmChatBack")?.addEventListener("click", () => {
    renderDMHome(screen);
    loadDMConversations(screen);
  });

  const composer = screen.querySelector("#dmComposer");
  const input = screen.querySelector("#dmMessageInput");

  composer?.addEventListener("submit", event => {
    event.preventDefault();
    sendDMMessage(screen, conversationId);
  });

  input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  await loadDMChat(screen, conversationId);
}

async function loadDMChat(screen, conversationId) {
  try {
    const data = await api(
      `/api/messages/conversations/${encodeURIComponent(conversationId)}`
    );

    if (!data.success) {
      throw new Error(data.error || "Could not load conversation.");
    }

    const user = data.conversation || {};
    const messages = data.messages || [];

    const name =
      user.display_name ||
      user.username ||
      "VYBE";

    const chatUser = screen.querySelector("#dmChatUser");

    if (chatUser) {
      chatUser.innerHTML = `
        ${dmAvatar(user, "dm-chat-avatar")}
        <span>
          <strong>${escapeHtml(name)}</strong>
          <small>@${escapeHtml(user.username || "")}</small>
        </span>
      `;
    }

    renderDMMessages(screen, messages);

    await api(
      `/api/messages/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: "PUT" }
    );

  } catch (error) {
    console.error("DM chat error:", error);

    const messages = screen.querySelector("#dmMessages");

    if (messages) {
      messages.innerHTML = `
        <div class="dm-empty-state dm-error-state">
          <div class="dm-empty-icon">${vybeIcon("dm")}</div>
          <h2>Couldn't load chat</h2>
          <p>${escapeHtml(error.message || "Please try again.")}</p>
        </div>
      `;
    }
  }
}

function renderDMMessages(screen, messages) {
  const container = screen.querySelector("#dmMessages");
  if (!container) return;

  if (!messages.length) {
    container.innerHTML = `
      <div class="dm-chat-empty">
        <div class="dm-chat-empty-icon">${vybeIcon("dm")}</div>
        <strong>Start the conversation</strong>
        <span>Send the first message.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(message => {
    const mine =
      String(message.sender_id) === String(state.user?.id);

    return `
      <div class="dm-message-row ${mine ? "is-mine" : "is-theirs"}">
        <div class="dm-message-bubble">
          <div class="dm-message-content">
            ${escapeHtml(message.content)}
          </div>
          <time>${escapeHtml(
            formatDMTime(message.created_at)
          )}</time>
        </div>
      </div>
    `;
  }).join("");

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function sendDMMessage(screen, conversationId) {
  const input = screen.querySelector("#dmMessageInput");
  const button = screen.querySelector(".dm-send-button");

  if (!input) return;

  const content = input.value.trim();

  if (!content) return;

  if (button) button.disabled = true;

  try {
    const data = await api(
      `/api/messages/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: "POST",
        body: JSON.stringify({ content })
      }
    );

    if (!data.success || !data.message) {
      throw new Error(data.error || "Could not send message.");
    }

    input.value = "";
    input.style.height = "auto";

    appendDMMessage(screen, data.message);
  } catch (error) {
    console.error("Send DM error:", error);
    alert(error.message || "Could not send message.");
  } finally {
    if (button) button.disabled = false;
  }
}

function showDM() {
  hideDynamicScreens();
  show(bottomNav);

  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  let screen = document.getElementById("dmScreen");

  if (!screen) {
    screen = document.createElement("section");
    screen.id = "dmScreen";
    screen.className = "screen dm-screen";
    document.body.appendChild(screen);
  }

  screen.classList.remove("hidden");
  setActiveNav("dm");

  initDMSocket();

  renderDMHome(screen);
  loadDMConversations(screen);
}

function setActiveNav(navName) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.nav === navName
    );
  });
}

document
  .querySelector('[data-nav="vybz"]')
  ?.addEventListener("click", showVybz);

document
  .querySelector('[data-nav="dm"]')
  ?.addEventListener("click", showDM);

/* VYBE comments composer */
(() => {
  const trigger =
    document.getElementById("openCommentComposer");

  const form =
    document.getElementById("commentForm");

  const input =
    document.getElementById("commentContent");

  if (!trigger || !form || !input) return;

  trigger.addEventListener("click", () => {
    trigger.classList.add("hidden");
    form.classList.remove("hidden");

    requestAnimationFrame(() => {
      input.focus();
    });
  });
})();
