/* global moment, markFormValidity, prefix, linkTarget, travelerStatus */

export function livespan(stamp, live = true) {
  if (live) {
    return `<span data-livestamp="${stamp}"></span>`;
  }
  return `<span>${moment(stamp).format('MMM D YYYY, HH:mm:ss ZZ')}</span>`;
}

export function generateHistoryRecordHtml(
  type,
  historyValue,
  inputBy,
  inputOn,
  live = false
) {
  if (type === 'url') {
    if (historyValue !== null) {
      if (historyValue.startsWith('http') === false) {
        historyValue = `http://${historyValue}`;
      }
      historyValue = `<a target="_blank" href=${historyValue}>${historyValue}</a>`;
    }
  }
  return `changed to <strong>${historyValue}</strong> by ${inputBy} ${livespan(
    inputOn,
    live
  )}; `;
}

export function history(found) {
  let i;
  let output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      const { inputType } = found[i];
      const historyValue = found[i].value;
      const { inputBy } = found[i];
      const { inputOn } = found[i];
      output =
        output +
        generateHistoryRecordHtml(inputType, historyValue, inputBy, inputOn);
    }
  }
  return output;
}

export function notes(found) {
  let i;
  let output = '<dl>';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = `${output}<div class="note" id=${found[i]._id} data-owner=${
        found[i].inputBy
      }><dt><b>${found[i].inputBy} created on ${livespan(
        found[i].inputOn,
        false
      )}`;
      if (found[i].updatedBy) {
        output += `, updated on ${livespan(found[i].updatedOn, false)} by ${
          found[i].updatedBy
        }`;
      }
      output += '</b>: </dt>';
      output = `${output}<dd>${found[i].value}</dd></div>`;
    }
  }
  return `${output}</dl>`;
}

export function fileHistory(found) {
  let i;
  let output = '';
  let link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = `${prefix}/data/${found[i]._id}`;
      output = `${output}<strong><a href=${link} target="${linkTarget}" download=${
        found[i].value
      }>${found[i].value}</a></strong> uploaded by ${
        found[i].inputBy
      } ${livespan(found[i].inputOn, false)}; `;
    }
  }
  return output;
}

export function renderNotes() {
  $.ajax({
    url: './notes/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      // notes append to input/textarea not .controls
      $('#form .controls').each(function(index, controlsElement) {
        const $controlsElement = $(controlsElement);
        if ($controlsElement.children('.checkbox-set-controls').length > 0) {
          // skip the checkbox set
          return;
        }
        const inputElements = $controlsElement.find('input,textarea');
        if (inputElements.length) {
          const element = inputElements[0];
          const found = data.filter(function(e) {
            return e.name === element.name;
          });
          $(element)
            .closest('.controls')
            .append(
              `<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">${found.length}</span></a> <a class="new-note" href="#" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a></div>`
            );
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            $(element)
              .closest('.controls')
              .append(
                `<div class="input-notes" style="display: none;">${notes(
                  found
                )}</div>`
              );
          }
        }
      });
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

export function renderHistory(binder, travelerStatus = null) {
  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        const $controlsElement = $(controlsElement);
        if ($controlsElement.children('.checkbox-set-controls').length > 0) {
          // skip the checkbox set
          return;
        }
        const inputElements = $controlsElement.find('input,textarea');
        let currentValue;
        if (inputElements.length) {
          let element = inputElements[0];
          const found = data.filter(function(e) {
            return e.name === element.name;
          });
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            if (element.type === 'file') {
              $(element)
                .closest('.controls')
                .append(
                  `<div class="input-history"><b>history</b>: ${fileHistory(
                    found
                  )}</div>`
                );
            } else {
              currentValue = found[0].value;
              if (found[0].inputType === 'radio') {
                // Update element to match the value
                for (let i = 0; i < inputElements.size(); i++) {
                  const ittrInput = inputElements[i];
                  if (ittrInput.value === currentValue) {
                    element = ittrInput;
                    break;
                  }
                }
              } else if (element.type === 'number') {
                // Patch to support appropriate stepping validation for input numbers.
                element.step = 'any';
              }
              binder.deserializeFieldFromValue(element, currentValue);
              binder.accessor.set(element.name, currentValue);
              $(element)
                .closest('.controls')
                .append(
                  `<div class="input-history"><b>history</b>: ${history(
                    found
                  )}</div>`
                );
            }
          }
        }
      });

      // check if active here
      if (travelerStatus === 1) {
        $('#form input,textarea').prop('disabled', false);
      }

      markFormValidity(document.getElementById('form'));

      // load the notes here
      renderNotes();
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}
