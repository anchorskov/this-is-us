// static/js/townhall/thread/reply-form-handler.js
//-------------------------------------------------

import { $$, qs }            from "./dom-utils.js";
import { THREADS, REPLIES }  from "./firestore-helpers.js";
import { showError }         from "./error-banner.js";

/**
 * Attaches submit-handler to the reply form and wires optimistic UI updates.
 * @param {HTMLFormElement} form   – the (cloned) #reply-form element
 * @param {HTMLElement}     list   – container where replies are rendered
 * @param {string}          threadId
 */
export function wireReplyForm(form, list, threadId) {
  /* ── ensure we only bind once ───────────────────────────────── */
  const oldForm = qs("#reply-form");
  if (oldForm) {
    const newForm = oldForm.cloneNode(true);
    oldForm.replaceWith(newForm);
    form = newForm;
  }

  const confirmationEl = qs("#reply-confirmation", form);

  /* ── main submit handler ────────────────────────────────────── */
  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();

    /* ---------- validation ---------- */
    const nameInput    = form.elements.name;
    const contentInput = form.elements.content;

    if (!nameInput || !contentInput) {
      return showError(form, "Form is missing required fields.");
    }

    const name     = nameInput.value.trim();
    const content  = contentInput.value.trim();
    const user     = firebase.auth().currentUser;

    // is the name field mandatory (not auto-filled)?
    const nameRequired = !nameInput.readOnly;

    if ((nameRequired && !name) || !content) {
      return showError(form, "Fill out both fields 😊");
    }
    if (!user) {
      return showError(form, "Please sign in first.");
    }

    /* ---------- optimistic UI ---------- */
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;

    // remove any old placeholders
    list.querySelector(".optimistic-placeholder")?.remove();

    const placeholder = $$(
      "div",
      "border-l-2 pl-3 italic text-gray-500 optimistic-placeholder"
    );
    placeholder.textContent = "Sending…";
    list.appendChild(placeholder);

    /* ---------- Firestore write ---------- */
    try {
      await REPLIES(threadId).add({
        displayName: name || user.displayName || "Anonymous",
        content,
        uid: user.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // increment replyCount on parent thread
      await firebase
        .firestore()
        .runTransaction((tx) =>
          tx.update(
            THREADS().doc(threadId),
            { replyCount: firebase.firestore.FieldValue.increment(1) }
          )
        );

      /* ---------- success UI ---------- */
      form.reset();
      nameInput.focus(); // (will stay blank if read-only)
      confirmationEl?.classList.remove("hidden");
      setTimeout(() => confirmationEl?.classList.add("hidden"), 5_000);
    } catch (err) {
      console.error("❌ Reply error:", err);
      placeholder.remove();
      showError(form, "Couldn’t post reply – try again.");
    } finally {
      submitBtn.disabled = false;
      list
        .querySelector(".optimistic-placeholder")
        ?.remove(); // clean up if still present
    }
  });
}
