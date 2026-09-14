/* global moment, markFormValidity, prefix, linkTarget, travelerStatus, traveler */

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
      output = `${output}<span class="file-history-item" id="${
        found[i]._id
      }"><strong><a href=${link} target="${linkTarget}" download=${
        found[i].value
      }>${found[i].value}</a></strong> uploaded by ${
        found[i].inputBy
      } ${livespan(found[i].inputOn, false)}; </span>`;
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

// Looks up the human-readable label for an input `name`, the same way
// utilities/routes.js's resetTouched() picks the active form server-side —
// except `traveler.forms` here is a plain array (this page's JSON dump of
// the traveler document), not a Mongoose DocumentArray, so it's found with
// Array#find rather than `.id()`.
function findLabelForInput(name) {
  if (!traveler.forms || !traveler.forms.length) return name;
  const form =
    traveler.forms.length === 1
      ? traveler.forms[0]
      : traveler.forms.find(function(f) {
          return String(f._id) === String(traveler.activeForm);
        });
  return (form && form.labels && form.labels[name]) || name;
}

// Finds (or creates, positioned right below the input and above the history
// div) the single .ncr-links container a field's "Initiate NCR" button and
// its linked-NCR badges both live in, so the badges always render directly
// under the button rather than at the end of .controls (after history/notes).
function getOrCreateNcrLinksContainer($controls) {
  let $ncrLinks = $controls.children('.ncr-links');
  if ($ncrLinks.length > 0) {
    return $ncrLinks;
  }
  $ncrLinks = $('<div class="ncr-links"></div>');
  const $history = $controls.children('.input-history');
  if ($history.length > 0) {
    $ncrLinks.insertBefore($history);
  } else {
    $controls.append($ncrLinks);
  }
  return $ncrLinks;
}

// Appends the "Initiate NCR" action into one field's .controls div — used
// both by renderNcrLinks() at page load (for every already-touched input)
// and, after a first-time save, so the action appears with no page reload.
export function appendInitiateNcrLink(element) {
  const $ncrLinks = getOrCreateNcrLinksContainer($(element).closest('.controls'));
  if ($ncrLinks.find('.initiate-ncr-link').length > 0) {
    return;
  }
  const label = findLabelForInput(element.name);
  const href = `${prefix}/ncrs/new?traveler_id=${traveler._id}&input_name=${encodeURIComponent(
    element.name
  )}&input_label=${encodeURIComponent(label)}`;
  $ncrLinks.append(
    `<a class="initiate-ncr-link btn btn-warning btn-small" href="${href}" target="${linkTarget}"><i class="fa fa-exclamation-triangle"></i> Initiate NCR</a>`
  );
}

// Renders both halves of the per-input NCR display: the "Initiate NCR"
// action (for any input already in traveler.touchedInputs) and, fetched
// from GET ./ncr-links/, a link+status badge for every NCR already linked
// to that input — mirrors renderNotes()'s DOM-injection mechanics exactly.
export function renderNcrLinks() {
  $('#form .controls').each(function(index, controlsElement) {
    const $controlsElement = $(controlsElement);
    if ($controlsElement.children('.checkbox-set-controls').length > 0) {
      // skip the checkbox set
      return;
    }
    const inputElements = $controlsElement.find('input,textarea');
    if (!inputElements.length) {
      return;
    }
    const element = inputElements[0];
    if (traveler.touchedInputs && traveler.touchedInputs.indexOf(element.name) !== -1) {
      appendInitiateNcrLink(element);
    }
  });

  $.ajax({
    url: './ncr-links/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        const $controlsElement = $(controlsElement);
        if ($controlsElement.children('.checkbox-set-controls').length > 0) {
          return;
        }
        const inputElements = $controlsElement.find('input,textarea');
        if (!inputElements.length) {
          return;
        }
        const element = inputElements[0];
        const found = data.filter(function(e) {
          return e.input_name === element.name;
        });
        if (found.length) {
          const badges = found
            .map(function(e) {
              return `<a class="ncr-link-badge" href="${prefix}/ncrs/${e.ncr_id}" target="${linkTarget}"><span class="badge">${e.status}</span> ${e.ncr_number}</a>`;
            })
            .join(' ');
          const $ncrLinks = getOrCreateNcrLinksContainer($(element).closest('.controls'));
          $ncrLinks.append(`<div class="ncr-links-existing">${badges}</div>`);
        }
      });
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get linked NCRs</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
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

      // load the initiate-NCR actions and any already-linked NCRs
      renderNcrLinks();
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
