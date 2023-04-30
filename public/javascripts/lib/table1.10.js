/* global moment: false */
export const versionColumn = {
  title: 'V',
  data: '_v',
  defaultContent: '',
  width: '25px',
};

export function versionRadioColumn(title, name) {
  return {
    title,
    defaultContent: `<label class="radio"><input type="radio" name="${name}" class="radio-row"></label>`,
    width: '25px',
  };
}

function formatDateLong(date) {
  return date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '';
}

export function longDateColumn(title, key) {
  return {
    title,
    data(row) {
      return formatDateLong(row[key]);
    },
    defaultContent: '',
  };
}

export const dom =
  "<'row-fluid'<'span6'<'control-group'B>>><'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";

export const domI = "t<'row-fluid'<'span6'i>>";
