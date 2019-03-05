
export default class UserSession {
  public id: string;
  public data?: any

  constructor(id: string) {
    this.id = id;
  }
}