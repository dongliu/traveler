/* global fnGetSelected, modalScroll, formatItemUpdate, selectColumn, binderLinkColumn, 
    titleColumn, tagsColumn, createdOnColumn, updatedOnColumn, fnAddFilterFoot, 
    sDomNoTNoR, selectEvent, filterEvent, moment */

export function formatItemUpdate(data) {
  return `<div class="target" id="${data._id}"><b>${
    data.title
  }</b>, created ${moment(data.createdOn).fromNow()}${
    data.updatedOn ? `, updated ${moment(data.updatedOn).fromNow()}` : ''
  }</div>`;
}
