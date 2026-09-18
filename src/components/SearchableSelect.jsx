import { useEffect, useId, useMemo, useRef, useState } from "react";

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  searchable = true,
  getOptionBadge,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized && searchable
      ? options.filter((option) => option.toLowerCase().includes(normalized))
      : options;
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, matches]);

  const openList = () => {
    if (open) return;
    setQuery("");
    setActiveIndex(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const commit = (option) => {
    onChange(option);
    setOpen(false);
    setQuery("");
  };
  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        Math.min(Math.max(index + step, 0), matches.length - 1),
      );
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[activeIndex]) commit(matches[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };
  const listbox = open && (
    <ul
      className="combobox-list"
      id={`${id}-list`}
      role="listbox"
      ref={listRef}
    >
      {matches.length === 0 ? (
        <li className="combobox-empty">No matches</li>
      ) : (
        matches.map((option, index) => (
          <li
            key={option}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={option === value}
            className={`combobox-option ${index === activeIndex ? "is-active" : ""} ${option === value ? "is-selected" : ""}`}
            onMouseMove={() => setActiveIndex(index)}
            onPointerDown={(event) => {
              event.preventDefault();
              commit(option);
            }}
          >
            <span className="combobox-option__label">{option}</span>
            {getOptionBadge && (
              <span className="combobox-option__badge">
                {getOptionBadge(option)}
              </span>
            )}
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className={`combobox ${open ? "is-open" : ""}`} ref={wrapperRef}>
      <label htmlFor={`${id}-input`}>{label}</label>
      <div className="combobox-field">
        {searchable ? (
          <input
            id={`${id}-input`}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[activeIndex]
                ? `${id}-option-${activeIndex}`
                : undefined
            }
            value={open ? query : value}
            placeholder={open ? value : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={openList}
            onClick={openList}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <button
            id={`${id}-input`}
            type="button"
            className="combobox-trigger"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-haspopup="listbox"
            aria-activedescendant={
              open && matches[activeIndex]
                ? `${id}-option-${activeIndex}`
                : undefined
            }
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={handleKeyDown}
          >
            {value}
          </button>
        )}
        <span className="combobox-caret" aria-hidden="true" />
      </div>
      {listbox}
    </div>
  );
}
