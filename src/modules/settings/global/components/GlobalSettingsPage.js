'use client';
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.GlobalSettingsPage = GlobalSettingsPage;
var core_1 = require('@mantine/core');
var useGlobalSettingsTabs_1 = require('../hooks/useGlobalSettingsTabs');
var SettingsToolbar_1 = require('./SettingsToolbar');
var SettingsTabContent_1 = require('./SettingsTabContent');
function GlobalSettingsPage() {
  var _a = (0, useGlobalSettingsTabs_1.useGlobalSettingsTabs)(),
    activeTab = _a.activeTab,
    setActiveTab = _a.setActiveTab,
    searchValue = _a.searchValue,
    onSearchChange = _a.onSearchChange,
    actions = _a.actions;
  return (
    <core_1.Stack gap="lg">
      <SettingsToolbar_1.SettingsToolbar
        activeTab={activeTab}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onTabChange={setActiveTab}
        actions={actions}
      />

      <SettingsTabContent_1.SettingsTabContent activeTab={activeTab} />
    </core_1.Stack>
  );
}
