import {  ShogunIpfsConfig, PinataServiceConfig, IpfsServiceConfig, CustomGatewayConfig } from "./types";
import { PinataService } from "./services/pinata";
import { IpfsService } from "./services/ipfs-http-client";
import { CustomGatewayService } from "./services/custom-gateway";
import { StorageService } from './services/base-storage';

export function ShogunIpfs(options: ShogunIpfsConfig): StorageService {
  switch (options.service) {
    case "PINATA": {
      const pinataConfig = options.config as PinataServiceConfig;
      if (!pinataConfig.pinataJwt) {
        throw new Error('Configurazione Pinata non valida: richiesto pinataJwt');
      }
      return new PinataService(pinataConfig);
    }

    case "IPFS-CLIENT": {
      const ipfsConfig = options.config as IpfsServiceConfig;
      if (!ipfsConfig.url) {
        throw new Error('Configurazione IPFS non valida: richiesto url');
      }
      return new IpfsService(ipfsConfig);
    }

    case "CUSTOM": {
      const customConfig = options.config as CustomGatewayConfig;
      if (!customConfig.url) {
        throw new Error('Configurazione Custom Gateway non valida: richiesto url');
      }
      return new CustomGatewayService(customConfig);
    }

    default:
      throw new Error(`Servizio di storage non supportato: ${options.service}`);
  }
}
