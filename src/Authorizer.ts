import AuthorizerBase from './AuthorizerBase';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface SessionHandlerConfig {
  autoDeserialize?: boolean
}

export interface ExtendedRequest extends Request {
  user?: any;
}

export interface RequestHandlerWithUser {
  (req: ExtendedRequest, res: Response, next: NextFunction): any;
}

export default class Authorizer extends AuthorizerBase {

  private deserialize = async (token: string) => {
    const data = await this._client.getAsync(token);
    if (!data) return null;
    let result: any;
    try {
      result = await this._postDeseserialize(data);
      if (!result) {
        throw new Error('deserialize function returned nothing')
      }
    } catch (err) {
      console.log('postDeserialize function error:');
      throw err;
    }
    return result;
  }

  public sessionHandler = (config?: SessionHandlerConfig): RequestHandlerWithUser => {
    return async (req, res, next) => {
      if (!req.cookies.atk) next();
      req.user = await this.deserialize(req.cookies.atk);
      next();
    }
  }

}