'use strict';

const state = {
  auth: {
    token: null,
    user: null,
    payload: null
  },
  classes: {
    tenantId: null,
    list: [],
    ids: [],
    idsByName: {},
    byId: {}
  }
};

function resetAuthContext() {
  state.auth = {
    token: null,
    user: null,
    payload: null
  };
}

function resetClassesContext() {
  state.classes = {
    tenantId: null,
    list: [],
    ids: [],
    idsByName: {},
    byId: {}
  };
}

function setAuthContext(auth = {}) {
  state.auth = {
    ...state.auth,
    ...auth
  };
  return state.auth;
}

function setClassesContext(classes = {}) {
  const list = Array.isArray(classes.list) ? classes.list : [];
  const idsByName = classes.idsByName && typeof classes.idsByName === 'object' ? classes.idsByName : {};
  const byId = classes.byId && typeof classes.byId === 'object' ? classes.byId : {};
  const ids = Array.isArray(classes.ids) ? classes.ids : list
    .map((row) => row?.id_classe)
    .filter((value) => value !== undefined && value !== null);

  state.classes = {
    ...state.classes,
    ...classes,
    list,
    ids,
    idsByName,
    byId
  };

  return state.classes;
}

function getAuthContext() {
  return state.auth;
}

function getClassesContext() {
  return state.classes;
}

module.exports = {
  resetAuthContext,
  resetClassesContext,
  setAuthContext,
  setClassesContext,
  getAuthContext,
  getClassesContext
};
