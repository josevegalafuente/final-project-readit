import "./css/style.css";

const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_API_URL = "https://openlibrary.org/search.json";

const LIBRARY_KEY = "readit-library";
const READING_PLAN_KEY = "readit-reading-plan";
const NOTES_KEY = "readit-notes";

let activeSearchResults = [];

const fallbackBooks = [
  {
    id: "fallback-atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Self Improvement",
    description: "A practical guide to building better habits.",
    pageCount: 320,
    thumbnail: "",
    infoLink: "",
    source: "Fallback",
  },
  {
    id: "fallback-deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Productivity",
    description: "A book about focused work in a distracted world.",
    pageCount: 304,
    thumbnail: "",
    infoLink: "",
    source: "Fallback",
  },
  {
    id: "fallback-seven-habits",
    title: "The 7 Habits of Highly Effective People",
    author: "Stephen R. Covey",
    category: "Personal Growth",
    description: "A classic book about personal effectiveness.",
    pageCount: 432,
    thumbnail: "",
    infoLink: "",
    source: "Fallback",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFromStorage(key, fallbackValue = []) {
  const data = localStorage.getItem(key);

  if (!data) {
    return fallbackValue;
  }

  try {
    return JSON.parse(data);
  } catch {
    return fallbackValue;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLibraryBooks() {
  return getFromStorage(LIBRARY_KEY, []);
}

function saveLibraryBooks(books) {
  saveToStorage(LIBRARY_KEY, books);
}

function normalizeGoogleBook(item) {
  const volumeInfo = item.volumeInfo || {};
  const imageLinks = volumeInfo.imageLinks || {};

  return {
    id: `google-${item.id}`,
    title: volumeInfo.title || "Untitled book",
    author: volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown author",
    category: volumeInfo.categories ? volumeInfo.categories[0] : "General",
    description: volumeInfo.description || "No description available.",
    pageCount: volumeInfo.pageCount || 0,
    publishedDate: volumeInfo.publishedDate || "Unknown date",
    publisher: volumeInfo.publisher || "Unknown publisher",
    thumbnail: imageLinks.thumbnail
      ? imageLinks.thumbnail.replace("http://", "https://")
      : "",
    infoLink: volumeInfo.infoLink || "",
    source: "Google Books",
  };
}

function normalizeOpenLibraryBook(item) {
  const coverId = item.cover_i;
  const bookKey = item.key || "";
  const subjects = item.subject || [];

  return {
    id: `openlibrary-${bookKey.replaceAll("/", "-")}`,
    title: item.title || "Untitled book",
    author: item.author_name ? item.author_name.join(", ") : "Unknown author",
    category: subjects.length > 0 ? subjects[0] : "General",
    description: "Description unavailable from Open Library search results.",
    pageCount: item.number_of_pages_median || 0,
    publishedDate: item.first_publish_year || "Unknown date",
    publisher: "Open Library",
    thumbnail: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : "",
    infoLink: bookKey ? `https://openlibrary.org${bookKey}` : "",
    source: "Open Library",
  };
}

async function fetchGoogleBooks(query, maxResults = 12) {
  const url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(
    query,
  )}&maxResults=${maxResults}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Books request failed: ${response.status}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map(normalizeGoogleBook);
}

async function fetchOpenLibraryBooks(query, maxResults = 12) {
  const fields = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "cover_i",
    "subject",
    "number_of_pages_median",
  ].join(",");

  const url = `${OPEN_LIBRARY_API_URL}?q=${encodeURIComponent(
    query,
  )}&limit=${maxResults}&fields=${fields}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open Library request failed: ${response.status}`);
  }

  const data = await response.json();
  const docs = data.docs || [];

  return docs.map(normalizeOpenLibraryBook);
}

async function fetchBooks(query, maxResults = 12) {
  try {
    const googleBooks = await fetchGoogleBooks(query, maxResults);

    if (googleBooks.length > 0) {
      return googleBooks;
    }
  } catch (error) {
    console.error("Google Books API error:", error);
  }

  try {
    const openLibraryBooks = await fetchOpenLibraryBooks(query, maxResults);

    if (openLibraryBooks.length > 0) {
      return openLibraryBooks;
    }
  } catch (error) {
    console.error("Open Library API error:", error);
  }

  throw new Error("No books could be loaded from the available APIs.");
}

function isBookSaved(bookId) {
  return getLibraryBooks().some((book) => book.id === bookId);
}

function createBookCard(book, options = {}) {
  const { showAddButton = true, showRemoveButton = false } = options;
  const saved = isBookSaved(book.id);

  const coverContent = book.thumbnail
    ? `<img src="${escapeHtml(book.thumbnail)}" alt="${escapeHtml(
        book.title,
      )} cover" />`
    : `<span>${escapeHtml(book.title.charAt(0))}</span>`;

  return `
    <article class="book-card">
      <div class="book-cover">
        ${coverContent}
      </div>

      <div class="book-card-content">
        <p class="book-category">${escapeHtml(book.category)}</p>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author)}</p>
        <p class="muted">${book.pageCount ? `${book.pageCount} pages` : "Page count unavailable"}</p>
        <p class="muted">Source: ${escapeHtml(book.source)}</p>

        <div class="card-actions">
          ${
            book.infoLink
              ? `<a class="text-link" href="${escapeHtml(
                  book.infoLink,
                )}" target="_blank" rel="noopener">View details</a>`
              : ""
          }

          ${
            showAddButton
              ? `<button class="button button-secondary small-button" data-add-book="${escapeHtml(
                  book.id,
                )}" ${saved ? "disabled" : ""}>
                  ${saved ? "Saved" : "Add to Library"}
                </button>`
              : ""
          }

          ${
            showRemoveButton
              ? `<button class="button button-secondary small-button" data-remove-book="${escapeHtml(
                  book.id,
                )}">
                  Remove
                </button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

async function renderRecommendedBooks() {
  const container = document.querySelector("#recommended-books");

  if (!container) {
    return;
  }

  container.innerHTML = "<p>Loading recommended books...</p>";

  try {
    const books = await fetchBooks("self improvement books", 6);
    activeSearchResults = books;
    container.innerHTML = books.map((book) => createBookCard(book)).join("");
  } catch (error) {
    console.error("Recommended books error:", error);
    activeSearchResults = fallbackBooks;
    container.innerHTML = fallbackBooks
      .map((book) => createBookCard(book))
      .join("");
  }
}

function handleHomeSearch() {
  const form = document.querySelector("#home-search-form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const query = String(formData.get("query") || "").trim();

    if (!query) {
      return;
    }

    window.location.href = `/search/?query=${encodeURIComponent(query)}`;
  });
}

async function renderSearchResults(query) {
  const resultsContainer = document.querySelector("#search-results");
  const emptyState = document.querySelector("#search-empty-state");

  if (!resultsContainer) {
    return;
  }

  if (!query) {
    activeSearchResults = [];
    resultsContainer.innerHTML = "";

    if (emptyState) {
      emptyState.textContent = "Search for a book to see matching results.";
    }

    return;
  }

  resultsContainer.innerHTML = "<p>Searching books...</p>";

  if (emptyState) {
    emptyState.textContent = `Searching for "${query}"...`;
  }

  try {
    const books = await fetchBooks(query, 12);
    activeSearchResults = books;

    if (books.length === 0) {
      resultsContainer.innerHTML = "";

      if (emptyState) {
        emptyState.textContent = `No books found for "${query}". Try another search.`;
      }

      return;
    }

    if (emptyState) {
      emptyState.textContent = `Showing results for "${query}".`;
    }

    resultsContainer.innerHTML = books.map((book) => createBookCard(book)).join("");
  } catch (error) {
    console.error("Search error:", error);
    activeSearchResults = fallbackBooks;

    if (emptyState) {
      emptyState.textContent =
        "The external APIs could not be reached. Showing fallback books for testing.";
    }

    resultsContainer.innerHTML = fallbackBooks
      .map((book) => createBookCard(book))
      .join("");
  }
}

function handleSearchPage() {
  const form = document.querySelector("#search-page-form");
  const input = document.querySelector("#search-query");

  if (!form || !input) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("query") || "";

  input.value = initialQuery;
  renderSearchResults(initialQuery);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = input.value.trim();

    if (!query) {
      renderSearchResults("");
      return;
    }

    window.history.pushState({}, "", `/search/?query=${encodeURIComponent(query)}`);
    renderSearchResults(query);
  });
}

function handleAddBookClicks() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-book]");

    if (!button) {
      return;
    }

    const bookId = button.dataset.addBook;
    const book = activeSearchResults.find((item) => item.id === bookId);

    if (!book) {
      return;
    }

    const savedBooks = getLibraryBooks();

    if (savedBooks.some((savedBook) => savedBook.id === book.id)) {
      button.textContent = "Saved";
      button.disabled = true;
      return;
    }

    savedBooks.push(book);
    saveLibraryBooks(savedBooks);

    button.textContent = "Saved";
    button.disabled = true;
  });
}

function createManualBookId(title, author) {
  const base = `${title}-${author}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `manual-${base || Date.now()}-${Date.now()}`;
}

function showManualBookMessage(message, type = "success") {
  const messageElement = document.querySelector("#manual-book-message");

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.className = `manual-book-message ${type}`;
}

function handleManualBookForm() {
  const form = document.querySelector("#manual-book-form");
  const titleInput = document.querySelector("#manual-book-title");
  const authorInput = document.querySelector("#manual-book-author");
  const pagesInput = document.querySelector("#manual-book-pages");
  const categoryInput = document.querySelector("#manual-book-category");
  const descriptionInput = document.querySelector("#manual-book-description");

  if (
    !form ||
    !titleInput ||
    !authorInput ||
    !pagesInput ||
    !categoryInput ||
    !descriptionInput
  ) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const pageCount = Number(pagesInput.value);
    const category = categoryInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title || !author || !category || pageCount <= 0) {
      showManualBookMessage(
        "Please complete the manual book form with valid information.",
        "error",
      );
      return;
    }

    const savedBooks = getLibraryBooks();
    const alreadyExists = savedBooks.some(
      (book) =>
        book.title.toLowerCase() === title.toLowerCase() &&
        book.author.toLowerCase() === author.toLowerCase(),
    );

    if (alreadyExists) {
      showManualBookMessage(
        "This book is already saved in your library.",
        "error",
      );
      return;
    }

    const manualBook = {
      id: createManualBookId(title, author),
      title,
      author,
      category,
      description: description || "Manually added book.",
      pageCount,
      publishedDate: "Manual entry",
      publisher: "Manual entry",
      thumbnail: "",
      infoLink: "",
      source: "Manual Entry",
    };

    savedBooks.push(manualBook);
    saveLibraryBooks(savedBooks);

    form.reset();
    showManualBookMessage(
      `"${title}" was added to your library. You can now use it for Reading Plan and Notes.`,
      "success",
    );

    renderLibraryPage();
    populateReadingPlanBookOptions();
    populateNotesBookOptions();
  });
}

function renderLibraryPage() {
  const container = document.querySelector("#library-books");
  const emptyState = document.querySelector("#library-empty-state");

  if (!container) {
    return;
  }

  const books = getLibraryBooks();

  if (books.length === 0) {
    container.innerHTML = "";

    if (emptyState) {
      emptyState.textContent =
        "Your library is empty. Search for books and add them here.";
    }

    return;
  }

  if (emptyState) {
    emptyState.textContent = `${books.length} saved book${
      books.length === 1 ? "" : "s"
    }.`;
  }

  container.innerHTML = books
    .map((book) =>
      createBookCard(book, {
        showAddButton: false,
        showRemoveButton: true,
      }),
    )
    .join("");
}

function handleRemoveBookClicks() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-book]");

    if (!button) {
      return;
    }

    const bookId = button.dataset.removeBook;
    const updatedBooks = getLibraryBooks().filter((book) => book.id !== bookId);

    saveLibraryBooks(updatedBooks);
    renderLibraryPage();
    populateReadingPlanBookOptions();
    populateNotesBookOptions();
  });
}

function populateReadingPlanBookOptions() {
  const select = document.querySelector("#plan-book");

  if (!select) {
    return;
  }

  const books = getLibraryBooks();

  if (books.length === 0) {
    select.innerHTML = `<option value="">Add books to your library first</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Choose a book</option>
    ${books
      .map(
        (book) =>
          `<option value="${escapeHtml(book.id)}">${escapeHtml(
            book.title,
          )} by ${escapeHtml(book.author)}</option>`,
      )
      .join("")}
  `;
}

function displaySavedReadingPlan() {
  const container = document.querySelector("#saved-plan");

  if (!container) {
    return;
  }

  const plan = getFromStorage(READING_PLAN_KEY, null);

  if (!plan) {
    container.innerHTML = "<p>No reading plan saved yet.</p>";
    return;
  }

  container.innerHTML = `
    <article class="feature-card">
      <h3>${escapeHtml(plan.title)}</h3>
      <p>${escapeHtml(plan.currentPage)} / ${escapeHtml(plan.totalPages)} pages completed</p>
      <div class="progress-track" aria-label="Reading progress ${escapeHtml(
        plan.progress,
      )}%">
        <span class="progress-bar" style="width: ${escapeHtml(plan.progress)}%"></span>
      </div>
      <p class="progress-text">${escapeHtml(plan.remainingPages)} pages remaining</p>
      <p class="daily-goal">Goal: ${escapeHtml(plan.dailyPages)} pages per day</p>
    </article>
  `;
}

function handleReadingPlanPage() {
  const form = document.querySelector("#reading-plan-form");
  const select = document.querySelector("#plan-book");
  const currentPageInput = document.querySelector("#plan-current-page");
  const totalPagesInput = document.querySelector("#plan-total-pages");
  const daysInput = document.querySelector("#plan-days");
  const result = document.querySelector("#plan-result");

  if (!form || !select || !currentPageInput || !totalPagesInput || !daysInput) {
    return;
  }

  populateReadingPlanBookOptions();
  displaySavedReadingPlan();

  select.addEventListener("change", () => {
    const selectedBook = getLibraryBooks().find((book) => book.id === select.value);

    if (selectedBook && selectedBook.pageCount) {
      totalPagesInput.value = selectedBook.pageCount;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const selectedBook = getLibraryBooks().find((book) => book.id === select.value);
    const currentPage = Number(currentPageInput.value);
    const totalPages = Number(totalPagesInput.value);
    const days = Number(daysInput.value);

    if (!selectedBook || currentPage < 0 || totalPages <= 0 || days <= 0) {
      if (result) {
        result.textContent = "Please complete the form with valid numbers.";
      }

      return;
    }

    const remainingPages = Math.max(totalPages - currentPage, 0);
    const dailyPages = Math.ceil(remainingPages / days);
    const progress = Math.min(Math.round((currentPage / totalPages) * 100), 100);

    const plan = {
      bookId: selectedBook.id,
      title: selectedBook.title,
      currentPage,
      totalPages,
      days,
      remainingPages,
      dailyPages,
      progress,
    };

    saveToStorage(READING_PLAN_KEY, plan);
    displaySavedReadingPlan();

    if (result) {
      result.textContent = `Read ${dailyPages} page${
        dailyPages === 1 ? "" : "s"
      } per day to finish in ${days} day${days === 1 ? "" : "s"}.`;
    }
  });
}

function populateNotesBookOptions() {
  const select = document.querySelector("#note-book");

  if (!select) {
    return;
  }

  const books = getLibraryBooks();

  if (books.length === 0) {
    select.innerHTML = `<option value="">Add books to your library first</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Choose a book</option>
    ${books
      .map(
        (book) =>
          `<option value="${escapeHtml(book.id)}">${escapeHtml(
            book.title,
          )} by ${escapeHtml(book.author)}</option>`,
      )
      .join("")}
  `;
}

function renderNotes() {
  const notesList = document.querySelector("#notes-list");
  const emptyState = document.querySelector("#notes-empty-state");

  if (!notesList) {
    return;
  }

  const notes = getFromStorage(NOTES_KEY, []);

  if (notes.length === 0) {
    notesList.innerHTML = "";

    if (emptyState) {
      emptyState.textContent = "No notes saved yet.";
    }

    return;
  }

  if (emptyState) {
    emptyState.textContent = `${notes.length} saved note${
      notes.length === 1 ? "" : "s"
    }.`;
  }

  notesList.innerHTML = notes
    .map(
      (note) => `
        <article class="feature-card">
          <p class="book-category">${escapeHtml(note.bookTitle)}</p>
          <h3>${escapeHtml(note.date)}</h3>
          <p>${escapeHtml(note.text)}</p>
        </article>
      `,
    )
    .join("");
}

function handleNotesPage() {
  const form = document.querySelector("#note-form");
  const select = document.querySelector("#note-book");
  const textarea = document.querySelector("#note-text");

  if (!form || !select || !textarea) {
    return;
  }

  populateNotesBookOptions();
  renderNotes();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const selectedBook = getLibraryBooks().find((book) => book.id === select.value);
    const text = textarea.value.trim();

    if (!selectedBook || !text) {
      return;
    }

    const notes = getFromStorage(NOTES_KEY, []);

    notes.unshift({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
      bookId: selectedBook.id,
      bookTitle: selectedBook.title,
      text,
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });

    saveToStorage(NOTES_KEY, notes);

    textarea.value = "";
    select.value = "";

    renderNotes();
  });
}

function setCurrentYear() {
  const currentYear = document.querySelector("#current-year");

  if (!currentYear) {
    return;
  }

  currentYear.textContent = new Date().getFullYear();
}

renderRecommendedBooks();
handleHomeSearch();
handleSearchPage();
handleAddBookClicks();
handleManualBookForm();
handleRemoveBookClicks();
renderLibraryPage();
handleReadingPlanPage();
handleNotesPage();
setCurrentYear();