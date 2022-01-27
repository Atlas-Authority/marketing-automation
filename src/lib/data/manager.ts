import DataDir from "./dir";

class DataManager {

  latestDataDir() {
    return DataDir.root.subdir('in');
  }

}

export const dataManager = new DataManager();
