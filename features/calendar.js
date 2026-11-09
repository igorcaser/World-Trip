// Calendar tile on the country page: this country's dates and places.
import { createCalendar } from '../calendar-view.js';
import { sortStops } from '../ui.js';

export function create(container) {
  const cal = createCalendar(container);
  return {
    update({ stop, state }) {
      cal.update({ stops: state.stops, places: state.places, onlyStopId: stop.id, order: sortStops(state.stops) });
    }
  };
}
