import {fromJS} from 'immutable';
import {createStore} from 'redux';

const initialState = fromJS({
  elements: {},
  variables: {},
  style: {},
  displayError: false,
  displayOptions: false,
  exportLoading: false,
  displayExportObjectResult: false,
});

function addChartData(data) {
  return (existingData) => {
    return existingData.withMutations(map => {
      for (const config of data.values()) {
        const title = config.get('title');
        const seriesPath = [title, 'series'];
        if (!map.has(title)) {
          map = map.set(title, fromJS({
            title,
            type: config.get('type'),
            series: [],
          }))
        }
        let existingSeries = map.getIn(seriesPath);
        const newSeriesObject = {};
        const existingSeriesObject = {};
        for (const singleSeries of existingSeries.values()) {
          existingSeriesObject[singleSeries.get('name')] = true;
        }
        for (const singleSeries of config.get('series').values()) {
          if (existingSeriesObject[singleSeries.get('name')]) {
            newSeriesObject[singleSeries.get('name')] = singleSeries.get('data');
          }
        }
        for (const [index, singleSeries] of existingSeries.entries()) {
          if (newSeriesObject[singleSeries.get('name')]) {
            const existingData = singleSeries.get('data');
            const newData = newSeriesObject[singleSeries.get('name')];
            const newExistingData = existingData.concat(newData);
            existingSeries = existingSeries.set(index, singleSeries.set('data', newExistingData));
            map = map.setIn(seriesPath, existingSeries);
          }
        }
        for (const singleSeries of config.get('series').values()) {
          if (!existingSeriesObject[singleSeries.get('name')]) {
            map = map.updateIn(seriesPath, list => list.push(fromJS(singleSeries)))
          }
        }
      }
      return map;
    });
  };
}


const updateElementActions = {
  append: data => list => list.push(data),
  prepend: data => list => list.unshift(data),
  extend: data => list => list.concat(data),
  addChartData
};

function processElement(map, element) {
  const {children, id} = element;
  map = newElement(map, element);
  if (children) {
    for (const child of children) {
      child.parentId = id;
      map = processElement(map, child);
    }
  }
  return map;
}

function processInitialState(state, {style, variables, children}) {
  return state.withMutations(map => {
    map = map.set('style', fromJS(style));
    for (const variable of Object.values(variables)) {
      map = newVariable(map, variable)
    }
    for (const child of children) {
      map = processElement(map, child);
    }
    return map;
  });
}

function newElement(state, {id, index, data, parentId, elementType, props = {}}) {
  return state.setIn(['elements', id], fromJS({index, id, parentId, data, elementType, props, children: []}));
}

function removeElements(state, {ids}) {
  return state.withMutations(map => {
    for (const id of ids) {
      map = map.removeIn(['elements', id])
    }
    return map;
  });
}

function newVariable(state, {id, value, version}) {
  return state.setIn(['variables', id], fromJS({id, value, version}));
}

function updateVariable(state, {id, value, version = -1}) {
  const internal = version === -1;
  const currentVersion = state.getIn(['variables', id, 'version']);
  if (!internal && currentVersion >= version) {
    return state;
  }
  const update = {value};
  if (!internal) {
    update.version = version;
  }
  return state.mergeIn(['variables', id], fromJS(update));
}

function updatePath(prefix) {
  return (state, {id, updateData}) => {
    const {path = [], action, data} = updateData;
    const fullPath = [prefix, id].concat(path);
    if (action === 'set') {
      return state.setIn(fullPath, fromJS(data));
    } else {
      return state.updateIn(fullPath, updateElementActions[action](fromJS(data)));
    }
  }
}

function displayError(state, {error}) {
  return state.set('displayError', error);
}

function displayOptions(state, {displayOptions}) {
  return state.set('displayOptions', displayOptions);
}

function exportLoading(state, {exportLoading}) {
  return state.set('exportLoading', exportLoading);
}

function displayExportObjectResult(state, {displayExportObjectResult}) {
  return state.set('displayExportObjectResult', fromJS(displayExportObjectResult));
}

const reducers = {
  processInitialState,
  newElement,
  removeElements,
  newVariable,
  updateElement: updatePath('elements'),
  updateVariable,
  displayError,
  displayOptions,
  exportLoading,
  displayExportObjectResult,
};

function reducer(state = initialState, action) {
  const actionReducer = reducers[action.type];
  return actionReducer ? actionReducer(state, action) : state;
}

export default createStore(reducer);
