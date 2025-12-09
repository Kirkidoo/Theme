document.addEventListener("DOMContentLoaded", () => {
  const inlineMenus = document.querySelectorAll(".navigation-main-inline");

  inlineMenus.forEach((menu) => {
    // Find all top-level items with submenus
    const topLevelItems = menu.querySelectorAll(
      ":scope > .has-sub-menu:not(.navigation-item-static)",
    );

    topLevelItems.forEach((topItem) => {
      const topSubmenu = topItem.querySelector(":scope > .navigation-sub-menu:not(.mega-menu)");
      if (!topSubmenu) return;

      topItem.addEventListener("mouseleave", () => {
        // Close nested menus
        const expandedItems = topSubmenu.querySelectorAll(".has-sub-menu.is-expanded");
        expandedItems.forEach((item) => item.classList.remove("is-expanded"));

        // Force close the first-level submenu (prevents hover state from keeping it open)
        topItem.classList.add("force-close");

        // Remove force-close class after transition completes (300ms)
        setTimeout(() => {
          topItem.classList.remove("force-close");
        }, 350);
      });

      // Find all nested submenu items (level 2) within this top-level item
      const nestedSubmenus = topSubmenu.querySelectorAll(".has-sub-menu");

      nestedSubmenus.forEach((submenuItem) => {
        const link = submenuItem.querySelector(":scope > a");
        const childMenu = submenuItem.querySelector(":scope > .navigation-sub-menu");
        if (!link || !childMenu) return;

        link.addEventListener("click", (event) => {
          // Check if the link has a hash href. Links can't be blank.
          const href = link.getAttribute("href");
          const isHashLink = href === "#";

          // Check if the click target is the icon
          const isIconClick = event.target.closest(".navigation-item-icon");

          // Expand if: icon is clicked OR it's a hash link
          if (isIconClick || isHashLink) {
            event.preventDefault();
            event.stopPropagation();

            // Toggle is-expanded class
            const isExpanded = submenuItem.classList.contains("is-expanded");

            // Close other open nested menus at the same level
            const siblings = Array.from(submenuItem.parentElement.children).filter(
              (item) => item !== submenuItem && item.classList.contains("has-sub-menu"),
            );

            // Hide siblings immediately
            siblings.forEach((sibling) => {
              const siblingSubmenu = sibling.querySelector(":scope > .navigation-sub-menu");

              sibling.classList.remove("is-expanded");

              if (siblingSubmenu) {
                setTimeout(() => {
                  siblingSubmenu.style.display = "";
                }, 50);
              }
            });

            // Toggle this menu
            if (!isExpanded) {
              submenuItem.classList.add("is-expanded");
            } else {
              submenuItem.classList.remove("is-expanded");
            }
          }
        });
      });
    });
  });
});
