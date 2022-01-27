import DataDir from "./dir";

class DataManager {

  newDataDir() {
    return DataDir.root.subdir('in');
  }

  latestDataDir() {
    return DataDir.root.subdir('in');
  }

}

export const dataManager = new DataManager();
