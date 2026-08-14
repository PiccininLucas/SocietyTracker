//#region src/core/application/use-cases/GetLeaderboardUseCase.ts
var GetLeaderboardUseCase = class {
	matchRepository;
	constructor(matchRepository) {
		this.matchRepository = matchRepository;
	}
	async execute() {
		return (await this.matchRepository.getLeaderboard()).map((item) => ({
			playerId: item.playerId,
			name: item.name,
			nickname: item.nickname,
			displayName: item.nickname || item.name,
			avatarUrl: item.avatarUrl,
			totalGoals: Number(item.totalGoals) || 0,
			totalAssists: Number(item.totalAssists) || 0,
			totalContributions: Number(item.totalContributions) || 0,
			totalSessionsPlayed: Number(item.totalSessionsPlayed) || 0
		}));
	}
};
//#endregion
export { GetLeaderboardUseCase as t };
