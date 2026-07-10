/**
 * Minimal view switcher for the small widget: shows one view at a time inside
 * a shared container and notifies listeners on change.
 */
export type ViewName = "timer" | "patrones" | "ajustes";

export interface Nav {
  el: HTMLElement;
  show: (view: ViewName) => void;
  current: () => ViewName;
}

export function createNav(
  views: Record<ViewName, HTMLElement>,
  onSwitch?: (view: ViewName) => void,
): Nav {
  const container = document.createElement("div");
  container.className = "views";
  container.append(...(Object.values(views) as HTMLElement[]));

  let active: ViewName = "timer";

  const show = (view: ViewName) => {
    active = view;
    (Object.keys(views) as ViewName[]).forEach((name) => {
      views[name].hidden = name !== view;
    });
    container.dataset.active = view;
    onSwitch?.(view);
  };

  show("timer");

  return { el: container, show, current: () => active };
}
