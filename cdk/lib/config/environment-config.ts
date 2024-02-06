
export interface EnvironmentConfig {
    postgresDBInstanceType: string;
    postgresDBAllocatedStorage: number;
    postgresDBPort: number
    postgresDBMasterUsername: string,
    sqlServerDBInstanceType: string;
    sqlServerDBAllocatedStorage: number;
    sqlServerDBPort: number
    sqlServerDBMasterUsername: string,
}
export const devEnvironmentConfig: EnvironmentConfig = {
    postgresDBInstanceType: 't3.micro',
    postgresDBAllocatedStorage: 20,
    postgresDBPort: 5432,
    postgresDBMasterUsername: 'postgres',
    sqlServerDBInstanceType: 't3.micro',
    sqlServerDBAllocatedStorage: 20,
    sqlServerDBPort: 1433,
    sqlServerDBMasterUsername: 'admin',
};
export const prodEnvironmentConfig: EnvironmentConfig = {
    postgresDBInstanceType: 'm5d.large',
    postgresDBAllocatedStorage: 20,
    postgresDBPort: 5432,
    postgresDBMasterUsername: 'postgres',
    sqlServerDBInstanceType: 't3.micro',
    sqlServerDBAllocatedStorage: 20,
    sqlServerDBPort: 1433,
    sqlServerDBMasterUsername: 'admin',
};
