import redis, { RedisClient } from 'redis';
import { promisifyAll } from 'bluebird';

export interface PromisifiedClient extends RedisClient {
  getAsync(key: string): Promise<string>
  setAsync(key: string): Promise<void>
}

interface PreSerialize {
  (data: any): string | Promise<string>;
}

interface PostDeserialize {
  (data: any): any;
}

export interface AuthBaseOpts extends redis.ClientOpts {
  preSerialize?: PreSerialize;
  postDeserialize?: PostDeserialize;
}

export interface AuthOptsPort extends redis.ClientOpts {
  port: number;
}

export interface AuthOptsHost extends AuthOptsPort {
  host: string;
}

export interface AuthOptsUrl extends redis.ClientOpts {
  redis_url: string;
}

export interface AuthOptsSocket extends redis.ClientOpts {
  unix_socket: string;
}

export default abstract class Authorizer {
  protected _client: PromisifiedClient;
  protected _postDeseserialize: PostDeserialize
  protected _preSerialize: PreSerialize

  constructor();
  constructor(options: AuthBaseOpts);
  constructor(options: AuthOptsPort);
  constructor(options: AuthOptsHost);
  constructor(options: AuthOptsUrl);
  constructor(options: AuthOptsSocket);
  constructor(authOptions?: any) {
    // optionally implement to stringify objects to be 
    // stored in redis
    if (!authOptions.preSerialize)
      authOptions.preSerialize = (data: string) => data;

    // optionally implement to perform database queries with 
    // incomplete data stored in redis
    if (!authOptions.postDeserialize)
      authOptions.postSerialize = (data: string) => data;

    let { preSerialize, postDeserialize, ...options } = authOptions

    this._preSerialize = preSerialize;
    this._postDeseserialize = postDeserialize;

    promisifyAll(redis);

    let client: RedisClient;
    if (!options) {
      client = redis.createClient();
    } else if (Authorizer.isAuthOptsPort(options)) {
      const { port, ...opts } = options;
      client = redis.createClient(port, undefined, opts);
    } else if (Authorizer.isAuthOptsHost(options)) {
      const { port, host, ...opts } = options;
      client = redis.createClient(port, host, opts);
    } else if (Authorizer.isAuthOptsSocket(options)) {
      const { unix_socket, ...opts } = options;
      client = redis.createClient(unix_socket, opts);
    } else if (Authorizer.isAuthOptsUrl(options)) {
      const { redis_url, ...opts } = options;
      client = redis.createClient(redis_url, opts);
    } else if (options instanceof Object) {
      client = redis.createClient(options);
    } else {
      throw new Error('Invalid parameters for Authorizer constructor')
    }

    this._client = client as PromisifiedClient;
  }

  private static isAuthOptsPort(arg: any): arg is AuthOptsPort {
    return arg.port && !arg.host !== undefined;
  }

  private static isAuthOptsHost(arg: any): arg is AuthOptsHost {
    return arg.host && arg.port !== undefined;
  }

  private static isAuthOptsUrl(arg: any): arg is AuthOptsUrl {
    return arg.redis_url !== undefined;
  }

  private static isAuthOptsSocket(arg: any): arg is AuthOptsSocket {
    return arg.socket_url !== undefined;
  }
}