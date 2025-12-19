'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.useGlobalSettingsTabs = useGlobalSettingsTabs;
var react_1 = require('react');
var DEFAULT_ACTIONS = [
  { value: 'users', label: 'User Management' },
  { value: 'backup', label: 'Backup & Restore', color: 'grape' },
];
function useGlobalSettingsTabs(initialTab) {
  if (initialTab === void 0) {
    initialTab = 'users';
  }
  var _a = (0, react_1.useState)(initialTab),
    activeTab = _a[0],
    setActiveTab = _a[1];
  var _b = (0, react_1.useState)(''),
    searchValue = _b[0],
    setSearchValue = _b[1];
  var actions = (0, react_1.useMemo)(function () {
    return DEFAULT_ACTIONS;
  }, []);
  var onSearchChange = (0, react_1.useCallback)(function (value) {
    setSearchValue(value);
  }, []);
  return {
    activeTab: activeTab,
    setActiveTab: setActiveTab,
    searchValue: searchValue,
    onSearchChange: onSearchChange,
    actions: actions,
  };
}
